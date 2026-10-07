// Command process reads a bank statement CSV export and prints each row as a
// parsed Transaction struct.
//
// Usage:
//
//	go run ./internal/scripts [path/to/file.csv]
//	go run ./internal/scripts categorise [path/to/file.csv]
//	go run ./internal/scripts review [threshold] [--list]
//	go run ./internal/scripts jev
//
// The categorise argument asks Jev, for every row, whether it is an expense and
// which of the categories in the database best describes it, writing the
// verdicts to tmp/jev-results.json. The review argument then walks the
// least-confident of those rows and asks for the right answer, saving each one
// to assets/jev/corrections.json — which categorise feeds back to Jev on the
// next run, so the same merchant isn't guessed at twice. The jev argument sends
// the Jev API's own example request, as a smoke test for the credentials and the
// client in expenny.co.za/internal/jev.
//
// Review is interactive and needs a real terminal. In particular it can't be run
// under air, which gives its child no TTY and kills it without a signal.
package main

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"charm.land/huh/v2"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"expenny.co.za/internal/corrections"
	"expenny.co.za/internal/jev"
	"expenny.co.za/internal/store/postgres"
)

const defaultCSVPath = "assets/csv/transactions.csv"

// Column positions in the statement export. The header is:
//
//	Nr,Account,Posting Date,Transaction Date,Description,Original Description,
//	Parent Category,Category,Money In,Money Out,Fee,Balance
const (
	colNr = iota
	colAccount
	colPostingDate
	colTransactionDate
	colDescription
	colOriginalDescription
	colParentCategory
	colCategory
	colMoneyIn
	colMoneyOut
	colFee
	colBalance

	numColumns
)

const (
	postingDateLayout     = "2006-01-02"
	transactionDateLayout = "2006-01-02 15:04"
)

// Transaction is a single row of the statement.
//
// MoneyIn, MoneyOut and Fee are sparse: a row populates one of the three and
// leaves the others blank. Signs are kept exactly as exported, so MoneyOut and
// Fee are normally negative but a correction can make Fee positive. Pending
// rows carry no running Balance.
type Transaction struct {
	Nr                  int
	Account             string
	PostingDate         time.Time
	TransactionDate     time.Time
	Description         string
	OriginalDescription string
	ParentCategory      string
	Category            string
	MoneyIn             float64
	MoneyOut            float64
	Fee                 float64
	Balance             float64
}

// parseAmount reads a money column, treating a blank cell as zero.
func parseAmount(s string) (float64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, nil
	}
	return strconv.ParseFloat(s, 64)
}

// parseDate reads a date column, treating a blank cell as the zero time.
func parseDate(s, layout string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, nil
	}
	return time.Parse(layout, s)
}

func parseRecord(rec []string) (Transaction, error) {
	var t Transaction
	var err error

	if t.Nr, err = strconv.Atoi(strings.TrimSpace(rec[colNr])); err != nil {
		return t, fmt.Errorf("Nr: %w", err)
	}
	if t.PostingDate, err = parseDate(rec[colPostingDate], postingDateLayout); err != nil {
		return t, fmt.Errorf("Posting Date: %w", err)
	}
	if t.TransactionDate, err = parseDate(rec[colTransactionDate], transactionDateLayout); err != nil {
		return t, fmt.Errorf("Transaction Date: %w", err)
	}
	if t.MoneyIn, err = parseAmount(rec[colMoneyIn]); err != nil {
		return t, fmt.Errorf("Money In: %w", err)
	}
	if t.MoneyOut, err = parseAmount(rec[colMoneyOut]); err != nil {
		return t, fmt.Errorf("Money Out: %w", err)
	}
	if t.Fee, err = parseAmount(rec[colFee]); err != nil {
		return t, fmt.Errorf("Fee: %w", err)
	}
	if t.Balance, err = parseAmount(rec[colBalance]); err != nil {
		return t, fmt.Errorf("Balance: %w", err)
	}

	// Text columns are kept verbatim — Original Description is padded with
	// leading spaces on some rows and that padding is part of the source data.
	t.Account = rec[colAccount]
	t.Description = rec[colDescription]
	t.OriginalDescription = rec[colOriginalDescription]
	t.ParentCategory = rec[colParentCategory]
	t.Category = rec[colCategory]

	return t, nil
}

// readTransactions parses every row of the statement, returning the rows it
// could read and a count of the ones it could not. A malformed row shouldn't
// abort the whole run, so failures are reported to stderr and counted rather
// than returned.
func readTransactions(path string) ([]Transaction, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = numColumns

	if _, err := r.Read(); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, 0, fmt.Errorf("%s: file is empty", path)
		}
		return nil, 0, fmt.Errorf("reading header: %w", err)
	}

	var (
		txns   []Transaction
		failed int
	)
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			fmt.Fprintf(os.Stderr, "skipping row: %v\n", err)
			failed++
			continue
		}

		t, err := parseRecord(rec)
		if err != nil {
			line, _ := r.FieldPos(0)
			fmt.Fprintf(os.Stderr, "skipping row at line %d: %v\n", line, err)
			failed++
			continue
		}

		txns = append(txns, t)
	}

	return txns, failed, nil
}

func run(path string) error {
	txns, failed, err := readTransactions(path)
	if err != nil {
		return err
	}

	for _, t := range txns {
		fmt.Printf("%+v\n", t)
	}

	if failed > 0 {
		return fmt.Errorf("%d row(s) could not be parsed", failed)
	}
	return nil
}

// runJev sends the example request from the Jev API documentation and prints
// the answers.
func runJev(ctx context.Context) error {
	_ = godotenv.Load()

	key := os.Getenv("JEV_API_KEY")
	if key == "" {
		return errors.New("JEV_API_KEY is not set")
	}

	resp, err := jev.New(key).Decide(ctx, jev.Request{
		State: map[string]any{
			"customer_tier": "enterprise",
			"ticket":        "My checkout page shows a blank screen after I click Pay.",
		},
		Questions: map[string]jev.Question{
			"team": jev.Choice("Which team should own this ticket?", map[string]string{
				"account":  "Login, permissions, or profile issues",
				"frontend": "Rendering, layout, or browser compatibility issues",
				"payments": "Checkout, billing, or payment processing issues",
			}),
		},
	})
	if err != nil {
		return err
	}

	fmt.Printf("model: %s\n", resp.Model)
	for _, name := range sortedKeys(resp.Answers) {
		printAnswer(name, resp.Answers[name])
	}
	fmt.Printf("\n%d in / %d out tokens, $%.6f\n",
		resp.Usage.InputTokens, resp.Usage.OutputTokens, resp.Usage.Cost)

	return nil
}

func printAnswer(name string, a jev.Answer) {
	fmt.Printf("\n%s (%s)\n", name, a.Type)

	switch a.Type {
	case jev.TypeChoice:
		fmt.Printf("  choice: %s\n", a.Choice)
	case jev.TypeScore:
		if a.Score != nil {
			fmt.Printf("  score: %.2f\n", *a.Score)
		}
		for _, level := range sortedKeys(a.Legend) {
			fmt.Printf("  %s = %s\n", level, a.Legend[level])
		}
	case jev.TypeNoul:
		if a.Noul != nil {
			fmt.Printf("  yes: %.0f%%\n", *a.Noul*100)
		}
	}

	if a.Confidence != nil {
		fmt.Printf("  confidence: %.0f%%\n", *a.Confidence*100)
	}
	for _, option := range sortedKeys(a.Probabilities) {
		fmt.Printf("  %-10s %.0f%%\n", option, a.Probabilities[option]*100)
	}
}

// sortedKeys keeps the output stable — answers and probabilities both arrive as
// maps, so iterating them directly would reorder the output on every run.
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// Questions asked about each statement row. The two are sent in one request —
// Jev answers the questions in a request in parallel, so batching them costs one
// round trip instead of two.
const (
	qExpense  = "is_expense"
	qCategory = "category"
)

// categoriseWorkers bounds how many rows are in flight at once. The statement is
// a couple of hundred rows and each call takes a few hundred milliseconds, so
// some concurrency is needed; too much just invites a 429.
const categoriseWorkers = 6

// Where the two JSON files live. Results are regenerable and land under tmp/,
// which is already gitignored; corrections are hand-made and worth committing.
const (
	resultsPath     = "tmp/jev-results.json"
	correctionsPath = "assets/jev/corrections.json"
)

// How a row's category was decided.
const (
	sourceRule = "rule"
	sourceJev  = "jev"
)

// feeCategory is the category every fee row is assigned without asking Jev.
const feeCategory = "bank-fees"

// rowResult is one row's verdict, kept alongside its row so the output can be
// printed back in statement order.
type rowResult struct {
	txn      Transaction
	expense  float64 // probability the row is an expense
	category string
	conf     float64
	source   string
	err      error
}

// savedResult is a rowResult flattened for tmp/jev-results.json, which is what
// the review command works from.
type savedResult struct {
	Nr          int     `json:"nr"`
	Description string  `json:"description"`
	MoneyOut    float64 `json:"money_out"`
	Fee         float64 `json:"fee"`
	Expense     float64 `json:"expense"`
	Category    string  `json:"category"`
	Confidence  float64 `json:"confidence"`
	Source      string  `json:"source"`
}

// runCategorise reads the statement, asks Jev to classify every row against the
// categories in the database, and prints the result.
//
// The Parent Category and Category columns already present in the export are
// deliberately ignored: the point is to see what Jev makes of the description on
// its own.
func runCategorise(ctx context.Context, path string) error {
	_ = godotenv.Load()

	key := os.Getenv("JEV_API_KEY")
	if key == "" {
		return errors.New("JEV_API_KEY is not set")
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return errors.New("DATABASE_URL is not set")
	}

	options, err := categoryOptions(ctx, dbURL)
	if err != nil {
		return err
	}

	known, err := corrections.Load(correctionsPath)
	if err != nil {
		return err
	}

	txns, failed, err := readTransactions(path)
	if err != nil {
		return err
	}

	fmt.Fprintf(os.Stderr, "classifying %d rows against %d categories, with %d past correction(s)...\n\n",
		len(txns), len(options), len(known))

	results := classify(ctx, jev.New(key), options, known, txns)
	printResults(results)

	if err := saveResults(resultsPath, results); err != nil {
		return err
	}
	fmt.Printf("results written to %s\n", resultsPath)

	if failed > 0 {
		return fmt.Errorf("%d row(s) could not be parsed", failed)
	}
	return nil
}

// saveResults persists the verdicts so review can work from them without paying
// to classify the statement again. Rows that errored are left out — there is
// nothing to review about a failed call.
func saveResults(path string, results []rowResult) error {
	saved := make([]savedResult, 0, len(results))
	for _, r := range results {
		if r.err != nil {
			continue
		}
		saved = append(saved, savedResult{
			Nr:          r.txn.Nr,
			Description: strings.TrimSpace(r.txn.Description),
			MoneyOut:    r.txn.MoneyOut,
			Fee:         r.txn.Fee,
			Expense:     r.expense,
			Category:    r.category,
			Confidence:  r.conf,
			Source:      r.source,
		})
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("failed to create %s: %w", filepath.Dir(path), err)
	}

	b, err := json.MarshalIndent(saved, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode results: %w", err)
	}
	if err := os.WriteFile(path, append(b, '\n'), 0o644); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, err)
	}
	return nil
}

// categoryOptions loads the categories and shapes them into Jev choice criteria:
// the category key is what comes back in the answer, the label is the
// description Jev matches the row against.
func categoryOptions(ctx context.Context, dbURL string) (map[string]string, error) {
	conn, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	defer conn.Close()

	cats, err := postgres.New(conn).GetAllCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load categories: %w", err)
	}

	options := make(map[string]string, len(cats))
	for _, c := range cats {
		// GetAllCategories doesn't filter soft deletes, so do it here.
		if c.DeletedAt.Valid {
			continue
		}
		options[c.Key] = c.Label
	}
	if len(options) == 0 {
		return nil, errors.New("no categories in the database")
	}
	return options, nil
}

// classify runs every row through Jev, returning results in statement order.
func classify(ctx context.Context, client *jev.Client, options map[string]string, known corrections.Set, txns []Transaction) []rowResult {
	results := make([]rowResult, len(txns))

	var wg sync.WaitGroup
	queue := make(chan int)

	for range categoriseWorkers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range queue {
				results[i] = classifyRow(ctx, client, options, known, txns[i])
			}
		}()
	}

	for i := range txns {
		queue <- i
	}
	close(queue)
	wg.Wait()

	return results
}

func classifyRow(ctx context.Context, client *jev.Client, options map[string]string, known corrections.Set, t Transaction) rowResult {
	res := rowResult{txn: t}

	// A fee is a bank charge by definition, so there is nothing to ask. No row
	// in the statement carries both a Fee and a Money Out amount, so this can't
	// shadow a real merchant.
	//
	// The row still isn't an expense: an expense is money out, and a fee is not
	// that. It carries the category so the charge can be attributed, but stays
	// off the expense ledger.
	if t.Fee != 0 {
		res.category = feeCategory
		res.conf = 1
		res.expense = 0
		res.source = sourceRule
		return res
	}
	res.source = sourceJev

	state := map[string]any{
		// Parent Category and Category are left out on purpose — handing Jev
		// the answer the bank already guessed would make the choice question
		// meaningless.
		"description":          strings.TrimSpace(t.Description),
		"original_description": strings.TrimSpace(t.OriginalDescription),
		"transaction_date":     t.TransactionDate.Format(transactionDateLayout),
		"money_in":             t.MoneyIn,
		"money_out":            t.MoneyOut,
		"fee":                  t.Fee,
	}

	categoryInstructions := "Which category best describes what this transaction was spent on? Match on the merchant and wording in the description."

	// Past corrections go in whole rather than as a single pre-matched entry, so
	// Jev can generalise sideways: a correction for one Woolworths branch should
	// inform the next one.
	if len(known) > 0 {
		state["past_corrections"] = known
		categoryInstructions += " The state includes past_corrections, a map of previously human-confirmed descriptions to category keys, keyed by a normalised form of the description with card and reference numbers removed. Where this row's merchant matches one of those entries, follow it."
	}

	resp, err := client.Decide(ctx, jev.Request{
		State: state,
		Questions: map[string]jev.Question{
			qExpense: jev.NoulWithCriteria(
				"This row is an expense: money left the account.",
				"The money_out field holds a non-zero amount.",
				"money_out is zero — the row is income or a transfer in.",
			),
			qCategory: jev.Choice(categoryInstructions, options),
		},
	})
	if err != nil {
		res.err = err
		return res
	}

	if a, ok := resp.Answers[qExpense]; ok && a.Noul != nil {
		res.expense = *a.Noul
	}
	if a, ok := resp.Answers[qCategory]; ok {
		res.category = a.Choice
		if a.Confidence != nil {
			res.conf = *a.Confidence
		}
	}
	return res
}

func printResults(results []rowResult) {
	var failed, disagreed, ruled int

	for _, r := range results {
		if r.err != nil {
			fmt.Fprintf(os.Stderr, "row %d: %v\n", r.txn.Nr, r.err)
			failed++
			continue
		}

		isExpense := r.expense >= 0.5

		// Jev's expense answer has a deterministic counterpart in the data, so a
		// mismatch is worth seeing — it's the cheapest signal of how far it can
		// be trusted on the category question, which has no ground truth. A
		// ruled row has nothing to disagree with.
		marker := " "
		if r.source == sourceJev && isExpense != (r.txn.MoneyOut != 0) {
			marker = "!"
			disagreed++
		}
		if r.source == sourceRule {
			ruled++
		}

		// A non-expense has no category worth showing, except a ruled fee row:
		// those carry one by design even though they stay off the ledger.
		label := r.category
		if !isExpense && r.source != sourceRule {
			label = "-"
		}

		// Fee rows carry their amount in the Fee column, not Money Out.
		amount := r.txn.MoneyOut
		if amount == 0 {
			amount = r.txn.Fee
		}

		fmt.Printf("%s %3d  %-44.44s %10.2f  %-22s %3.0f%%  %-4s\n",
			marker, r.txn.Nr, strings.TrimSpace(r.txn.Description), amount,
			label, r.conf*100, r.source)
	}

	classified := len(results) - failed
	fmt.Printf("\n%d rows classified (%d by rule, %d by Jev)", classified, ruled, classified-ruled)
	if disagreed > 0 {
		fmt.Printf(", %d disagreed with the Money Out column (marked !)", disagreed)
	}
	if failed > 0 {
		fmt.Printf(", %d failed", failed)
	}
	fmt.Println()
}

// Sentinel values for the two control entries at the bottom of the dropdown.
// Neither is a real category key, so neither can collide with one.
const (
	optKeep = "\x00keep"
	optSkip = "\x00skip"
)

// defaultReviewThreshold is the confidence below which a row is worth a second
// look. Overridable as the first argument to the review command.
const defaultReviewThreshold = 0.7

// runReview walks the low-confidence rows of the last classification and asks
// for the right category, saving each answer as it is given.
//
// Rows decided by rule are skipped: they are certain by construction. So are
// non-expenses, which have no category to correct.
func runReview(ctx context.Context, threshold float64, list bool) error {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return errors.New("DATABASE_URL is not set")
	}

	results, err := loadResults(resultsPath)
	if err != nil {
		return err
	}

	var queue []savedResult
	for _, r := range results {
		if r.Source == sourceJev && r.Expense >= 0.5 && r.Confidence < threshold {
			queue = append(queue, r)
		}
	}

	// Worst first, so the most valuable corrections are made even if the session
	// is cut short.
	sort.Slice(queue, func(i, j int) bool { return queue[i].Confidence < queue[j].Confidence })

	if len(queue) == 0 {
		fmt.Printf("nothing under %.0f%% confidence to review\n", threshold*100)
		return nil
	}

	if list {
		for _, r := range queue {
			fmt.Printf("%3d  %-44.44s %10.2f  %-22s %3.0f%%\n",
				r.Nr, r.Description, r.MoneyOut, r.Category, r.Confidence*100)
		}
		fmt.Printf("\n%d row(s) under %.0f%% confidence\n", len(queue), threshold*100)
		return nil
	}

	options, err := categoryOptions(ctx, dbURL)
	if err != nil {
		return err
	}

	known, err := corrections.Load(correctionsPath)
	if err != nil {
		return err
	}

	return review(queue, options, known)
}

func loadResults(path string) ([]savedResult, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("%s not found — run `go run ./internal/scripts categorise` first", path)
		}
		return nil, fmt.Errorf("failed to read %s: %w", path, err)
	}

	var results []savedResult
	if err := json.Unmarshal(b, &results); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", path, err)
	}
	return results, nil
}

// review prompts for each row in turn. Answers are written to disk one at a
// time: a session is long enough that losing it to a stray ctrl-c would hurt.
func review(queue []savedResult, options map[string]string, known corrections.Set) error {
	choices := make([]huh.Option[string], 0, len(options)+2)
	for _, key := range sortedKeys(options) {
		choices = append(choices, huh.NewOption(options[key], key))
	}

	var saved int
	for i, r := range queue {
		keep := fmt.Sprintf("── keep %s ──", r.Category)
		opts := append(slices.Clone(choices),
			huh.NewOption(keep, optKeep),
			huh.NewOption("── skip this row ──", optSkip),
		)

		// Pre-select whatever is already on record for this merchant, falling
		// back to Jev's pick, so pressing enter repeatedly is a safe no-op.
		choice := r.Category
		key := corrections.Normalise(r.Description)
		if prev, ok := known[key]; ok {
			choice = prev
		}

		err := huh.NewSelect[string]().
			Title(fmt.Sprintf("[%d/%d]  %s", i+1, len(queue), r.Description)).
			Description(fmt.Sprintf("R%.2f · Jev chose %s (%.0f%%) · saves as %q",
				-r.MoneyOut, r.Category, r.Confidence*100, key)).
			Options(opts...).
			Filtering(true).
			Value(&choice).
			Run()

		if err != nil {
			if errors.Is(err, huh.ErrUserAborted) {
				fmt.Printf("\nstopped at %d of %d — %d correction(s) saved to %s\n",
					i, len(queue), saved, correctionsPath)
				return nil
			}
			return err
		}

		if choice == optSkip {
			continue
		}
		if choice == optKeep {
			choice = r.Category
		}

		known[key] = choice
		if err := known.Save(correctionsPath); err != nil {
			return err
		}
		saved++
	}

	fmt.Printf("\nreviewed %d row(s) — %d correction(s) saved to %s\n",
		len(queue), saved, correctionsPath)
	return nil
}

func main() {
	path := defaultCSVPath
	if len(os.Args) > 1 {
		path = os.Args[1]
	}

	ctx := context.Background()

	var err error
	switch path {
	case "jev":
		err = runJev(ctx)
	case "categorise":
		csvPath := defaultCSVPath
		if len(os.Args) > 2 {
			csvPath = os.Args[2]
		}
		err = runCategorise(ctx, csvPath)
	case "review":
		threshold := defaultReviewThreshold
		list := false
		for _, arg := range os.Args[2:] {
			if arg == "--list" {
				list = true
				continue
			}
			if threshold, err = strconv.ParseFloat(arg, 64); err != nil {
				err = fmt.Errorf("threshold %q: %w", arg, err)
				break
			}
		}
		if err == nil {
			err = runReview(ctx, threshold, list)
		}
	default:
		err = run(path)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
