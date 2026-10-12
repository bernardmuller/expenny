package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"slices"
	"sort"

	"charm.land/huh/v2"
	"github.com/joho/godotenv"

	"expenny.co.za/internal/classifier"
	"expenny.co.za/internal/corrections"
)

const defaultReviewThreshold = 0.7

const (
	optKeep = "\x00keep"
	optSkip = "\x00skip"
)

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
		if r.Source == classifier.SourceJev && r.Expense >= 0.5 && r.Confidence < threshold {
			queue = append(queue, r)
		}
	}

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
			return nil, fmt.Errorf("%s not found — run `go run ./cmd/cli categorise` first", path)
		}
		return nil, fmt.Errorf("failed to read %s: %w", path, err)
	}

	var results []savedResult
	if err := json.Unmarshal(b, &results); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", path, err)
	}
	return results, nil
}

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

		choice := r.Category
		key := corrections.Normalise(r.Description)
		if prev, ok := known[key]; ok {
			choice = prev
		}

		err := huh.NewSelect[string]().
			Title(fmt.Sprintf("[%d/%d]  %s", i+1, len(queue), r.Description)).
			Description(fmt.Sprintf("R%.2f · provider chose %s (%.0f%%) · saves as %q",
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

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
