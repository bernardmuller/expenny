// Command process reads a bank statement CSV export and prints each row as a
// parsed Transaction struct.
//
// Usage:
//
//	go run ./internal/scripts [path/to/file.csv]
//	go run ./internal/scripts categorise [path/to/file.csv]
//	go run ./internal/scripts jev
//
// The categorise argument asks Jev, for every row, whether it is an expense and
// which of the categories in the database best describes it. The jev argument
// sends the Jev API's own example request — a smoke test for the credentials
// and the client in expenny.co.za/internal/jev.
package main

import (
	"context"
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"expenny.co.za/internal/jev"
	"expenny.co.za/internal/store/postgres"
)

const defaultCSVPath = "assets/csv/september.csv"

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

// rowResult is one row's verdict, kept alongside its row so the output can be
// printed back in statement order.
type rowResult struct {
	txn      Transaction
	expense  float64 // probability the row is an expense
	category string
	conf     float64
	err      error
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

	txns, failed, err := readTransactions(path)
	if err != nil {
		return err
	}

	fmt.Fprintf(os.Stderr, "classifying %d rows against %d categories...\n\n", len(txns), len(options))

	results := classify(ctx, jev.New(key), options, txns)
	printResults(results)

	if failed > 0 {
		return fmt.Errorf("%d row(s) could not be parsed", failed)
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
func classify(ctx context.Context, client *jev.Client, options map[string]string, txns []Transaction) []rowResult {
	results := make([]rowResult, len(txns))

	var wg sync.WaitGroup
	queue := make(chan int)

	for range categoriseWorkers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range queue {
				results[i] = classifyRow(ctx, client, options, txns[i])
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

func classifyRow(ctx context.Context, client *jev.Client, options map[string]string, t Transaction) rowResult {
	res := rowResult{txn: t}

	resp, err := client.Decide(ctx, jev.Request{
		// Parent Category and Category are left out on purpose — handing Jev
		// the answer the bank already guessed would make the choice question
		// meaningless.
		State: map[string]any{
			"description":          strings.TrimSpace(t.Description),
			"original_description": strings.TrimSpace(t.OriginalDescription),
			"transaction_date":     t.TransactionDate.Format(transactionDateLayout),
			"money_in":             t.MoneyIn,
			"money_out":            t.MoneyOut,
			"fee":                  t.Fee,
		},
		Questions: map[string]jev.Question{
			qExpense: jev.NoulWithCriteria(
				"This row is an expense: money left the account.",
				"The money_out field holds a non-zero amount.",
				"money_out is zero — the row is income, a fee-only line, or a transfer in.",
			),
			qCategory: jev.Choice(
				"Which category best describes what this transaction was spent on? Match on the merchant and wording in the description.",
				options,
			),
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
	var failed, disagreed int

	for _, r := range results {
		if r.err != nil {
			fmt.Fprintf(os.Stderr, "row %d: %v\n", r.txn.Nr, r.err)
			failed++
			continue
		}

		isExpense := r.expense >= 0.5

		// The expense question has a deterministic answer in the data, so a
		// mismatch is worth seeing — it's the cheapest signal of how far Jev
		// can be trusted on the category question, which has no ground truth.
		marker := " "
		if isExpense != (r.txn.MoneyOut != 0) {
			marker = "!"
			disagreed++
		}

		label := r.category
		if !isExpense {
			label = "-"
		}

		fmt.Printf("%s %3d  %-44.44s %10.2f  %-22s %3.0f%%  expense %3.0f%%\n",
			marker, r.txn.Nr, strings.TrimSpace(r.txn.Description), r.txn.MoneyOut,
			label, r.conf*100, r.expense*100)
	}

	fmt.Printf("\n%d rows classified", len(results)-failed)
	if disagreed > 0 {
		fmt.Printf(", %d disagreed with the Money Out column (marked !)", disagreed)
	}
	if failed > 0 {
		fmt.Printf(", %d failed", failed)
	}
	fmt.Println()
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
	default:
		err = run(path)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
