// Command process reads a bank statement CSV export and prints each row as a
// parsed Transaction struct.
//
// Usage:
//
//	go run ./internal/scripts [path/to/file.csv]
//	go run ./internal/scripts jev
//
// The jev argument instead sends the Jev API's own example request and prints
// the answers — a smoke test for the credentials and the client in
// expenny.co.za/internal/jev, ahead of using it to categorise statement rows.
package main

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"expenny.co.za/internal/jev"
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

func run(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = numColumns

	if _, err := r.Read(); err != nil {
		if errors.Is(err, io.EOF) {
			return fmt.Errorf("%s: file is empty", path)
		}
		return fmt.Errorf("reading header: %w", err)
	}

	var failed int
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			// A malformed row shouldn't abort the whole run.
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

func main() {
	path := defaultCSVPath
	if len(os.Args) > 1 {
		path = os.Args[1]
	}

	var err error
	if path == "jev" {
		err = runJev(context.Background())
	} else {
		err = run(path)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
