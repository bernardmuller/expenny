package statements

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

type ParseError struct {
	Line int
	Err  error
}

func (e *ParseError) Error() string { return fmt.Sprintf("line %d: %v", e.Line, e.Err) }

func (e *ParseError) Unwrap() error { return e.Err }

type Parser struct{}

func NewParser() *Parser { return &Parser{} }

func (p *Parser) ParseFile(path string) (txns []Transaction, rowErrs []error, err error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()

	return p.Parse(f)
}

func (p *Parser) Parse(r io.Reader) (txns []Transaction, rowErrs []error, err error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = numColumns

	if _, err := cr.Read(); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, nil, errors.New("file is empty")
		}
		return nil, nil, fmt.Errorf("reading header: %w", err)
	}

	for {
		rec, err := cr.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			line, _ := cr.FieldPos(0)
			rowErrs = append(rowErrs, &ParseError{Line: line, Err: err})
			continue
		}

		t, err := parseRecord(rec)
		if err != nil {
			line, _ := cr.FieldPos(0)
			rowErrs = append(rowErrs, &ParseError{Line: line, Err: err})
			continue
		}

		txns = append(txns, t)
	}

	return txns, rowErrs, nil
}

func parseRecord(rec []string) (Transaction, error) {
	var t Transaction
	var err error

	if t.Nr, err = strconv.Atoi(strings.TrimSpace(rec[colNr])); err != nil {
		return t, fmt.Errorf("Nr: %w", err)
	}
	if t.PostingDate, err = parseDate(rec[colPostingDate], PostingDateLayout); err != nil {
		return t, fmt.Errorf("Posting Date: %w", err)
	}
	if t.TransactionDate, err = parseDate(rec[colTransactionDate], TransactionDateLayout); err != nil {
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

	t.Account = rec[colAccount]
	t.Description = rec[colDescription]
	t.OriginalDescription = rec[colOriginalDescription]
	t.ParentCategory = rec[colParentCategory]
	t.Category = rec[colCategory]

	return t, nil
}

func parseAmount(s string) (float64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, nil
	}
	return strconv.ParseFloat(s, 64)
}

func parseDate(s, layout string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, nil
	}
	return time.Parse(layout, s)
}
