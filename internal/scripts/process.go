// Command process reads a bank statement CSV export and prints each row as a
// parsed Transaction struct.
//
// Usage:
//
//	go run ./internal/scripts [path/to/file.csv]
package main

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"
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

func main() {
	path := defaultCSVPath
	if len(os.Args) > 1 {
		path = os.Args[1]
	}

	if err := run(path); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
