package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"expenny.co.za/internal/classifier"
	"expenny.co.za/internal/classifier/jev"
	"expenny.co.za/internal/corrections"
	"expenny.co.za/internal/statements"
	"expenny.co.za/internal/store/postgres"
)

type savedResult struct {
	Nr          int               `json:"nr"`
	Description string            `json:"description"`
	MoneyOut    float64           `json:"money_out"`
	Fee         float64           `json:"fee"`
	Expense     float64           `json:"expense"`
	Category    string            `json:"category"`
	Confidence  float64           `json:"confidence"`
	Source      classifier.Source `json:"source"`
}

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

	txns, rowErrs, err := statements.NewParser().ParseFile(path)
	if err != nil {
		return err
	}

	fmt.Fprintf(os.Stderr, "classifying %d rows against %d categories, with %d past correction(s)...\n\n",
		len(txns), len(options), len(known))

	classifier := classifier.New(classifier.Config{
		Provider:   jev.New(key),
		Categories: options,
		Known:      known,
	})
	results := classifier.Classify(ctx, txns)
	printResults(results)

	if err := saveResults(resultsPath, results); err != nil {
		return err
	}
	fmt.Printf("results written to %s\n", resultsPath)

	return reportRowErrors(rowErrs)
}

func saveResults(path string, results []classifier.Result) error {
	saved := make([]savedResult, 0, len(results))
	for _, r := range results {
		if r.Err != nil {
			continue
		}
		saved = append(saved, savedResult{
			Nr:          r.Transaction.Nr,
			Description: strings.TrimSpace(r.Transaction.Description),
			MoneyOut:    r.Transaction.MoneyOut,
			Fee:         r.Transaction.Fee,
			Expense:     r.Expense,
			Category:    r.Category,
			Confidence:  r.Confidence,
			Source:      r.Source,
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

func printResults(results []classifier.Result) {
	var failed, disagreed, ruled int

	for _, r := range results {
		if r.Err != nil {
			fmt.Fprintf(os.Stderr, "row %d: %v\n", r.Transaction.Nr, r.Err)
			failed++
			continue
		}

		isExpense := r.Expense >= 0.5

		marker := " "
		if r.Source == classifier.SourceJev && isExpense != (r.Transaction.MoneyOut != 0) {
			marker = "!"
			disagreed++
		}
		if r.Source == classifier.SourceRule {
			ruled++
		}

		label := r.Category
		if !isExpense && r.Source != classifier.SourceRule {
			label = "-"
		}

		amount := r.Transaction.MoneyOut
		if amount == 0 {
			amount = r.Transaction.Fee
		}

		fmt.Printf("%s %3d  %-44.44s %10.2f  %-22s %3.0f%%  %-4s\n",
			marker, r.Transaction.Nr, strings.TrimSpace(r.Transaction.Description), amount,
			label, r.Confidence*100, r.Source)
	}

	classified := len(results) - failed
	fmt.Printf("\n%d rows classified (%d by rule, %d by provider)", classified, ruled, classified-ruled)
	if disagreed > 0 {
		fmt.Printf(", %d disagreed with the Money Out column (marked !)", disagreed)
	}
	if failed > 0 {
		fmt.Printf(", %d failed", failed)
	}
	fmt.Println()
}

func reportRowErrors(rowErrs []error) error {
	for _, e := range rowErrs {
		fmt.Fprintf(os.Stderr, "skipping row: %v\n", e)
	}
	if len(rowErrs) > 0 {
		return fmt.Errorf("%d row(s) could not be parsed", len(rowErrs))
	}
	return nil
}
