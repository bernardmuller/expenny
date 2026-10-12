package classifier

import (
	"context"
	"strings"
	"sync"

	"expenny.co.za/internal/corrections"
	"expenny.co.za/internal/statements"
	"expenny.co.za/internal/systemone"
)

type Source string

const (
	SourceRule     Source = "rule"
	SourceProvider Source = "provider"
)

const FeeCategory = "bank-fees"
const IncomeCategory = "income"

const (
	qExpense  = "is_expense"
	qCategory = "category"
)

const DefaultWorkers = 6

type Provider interface {
	Decide(ctx context.Context, req systemone.Request) (*systemone.Response, error)
}

type Config struct {
	Provider   Provider
	Categories map[string]string
	Known      corrections.Set
	Workers    int
}

type Classifier struct {
	provider   Provider
	categories map[string]string
	known      corrections.Set
	workers    int
}

func New(cfg Config) *Classifier {
	workers := cfg.Workers
	if workers <= 0 {
		workers = DefaultWorkers
	}
	return &Classifier{
		provider:   cfg.Provider,
		categories: cfg.Categories,
		known:      cfg.Known,
		workers:    workers,
	}
}

type Result struct {
	Transaction statements.Transaction
	Expense     float64 // probability the row is an expense
	Category    string
	Confidence  float64
	Source      Source
	Err         error
}

func (c *Classifier) Classify(ctx context.Context, txns []statements.Transaction) []Result {
	results := make([]Result, len(txns))

	var wg sync.WaitGroup
	queue := make(chan int, c.workers)

	for range c.workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range queue {
				results[i] = c.classifyRow(ctx, txns[i])
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

func (c *Classifier) classifyRow(ctx context.Context, t statements.Transaction) Result {
	res := Result{Transaction: t}

	if t.Fee != 0 {
		res.Category = FeeCategory
		res.Confidence = 1
		res.Expense = 0
		res.Source = SourceRule
		return res
	}

	if t.MoneyIn != 0 {
		res.Category = IncomeCategory
		res.Confidence = 1
		res.Expense = 0
		res.Source = SourceRule
		return res
	}

	res.Source = SourceProvider

	state := map[string]any{
		"description":          strings.TrimSpace(t.Description),
		"original_description": strings.TrimSpace(t.OriginalDescription),
		"transaction_date":     t.TransactionDate.Format(statements.TransactionDateLayout),
		"money_in":             t.MoneyIn,
		"money_out":            t.MoneyOut,
		"fee":                  t.Fee,
	}

	categoryInstructions := "Which category best describes what this transaction was spent on? Match on the merchant and wording in the description."

	if len(c.known) > 0 {
		state["past_corrections"] = c.known
		categoryInstructions += " The state includes past_corrections, a map of previously human-confirmed descriptions to category keys, keyed by a normalised form of the description with card and reference numbers removed. Where this row's merchant matches one of those entries, follow it."
	}

	resp, err := c.provider.Decide(ctx, systemone.Request{
		State: state,
		Questions: map[string]systemone.Question{
			qExpense: systemone.NoulWithCriteria(
				"This row is an expense: money left the account.",
				"The money_out field holds a non-zero amount.",
				"money_out is zero — the row is income or a transfer in.",
			),
			qCategory: systemone.Choice(categoryInstructions, c.categories),
		},
	})
	if err != nil {
		res.Err = err
		return res
	}

	if a, ok := resp.Answers[qExpense]; ok && a.Noul != nil {
		res.Expense = *a.Noul
	}
	if a, ok := resp.Answers[qCategory]; ok {
		res.Category = a.Choice
		if a.Confidence != nil {
			res.Confidence = *a.Confidence
		}
	}
	return res
}
