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

const (
	qExpense  = "is_expense"
	qCategory = "category"
	qGroup    = "group"
)

const DefaultWorkers = 6

type Provider interface {
	Decide(ctx context.Context, req systemone.Request) (*systemone.Response, error)
}

type Config struct {
	Provider   Provider
	Categories map[string]string
	// Groups is the group dictionary (key -> label) the provider chooses from.
	Groups map[string]string
	// Memberships maps a category key to the group keys it may be tagged
	// with, and is passed to the provider as state so it picks a legal pair.
	Memberships map[string][]string
	Known       corrections.Set
	Workers     int
}

type Classifier struct {
	provider    Provider
	categories  map[string]string
	groups      map[string]string
	memberships map[string][]string
	known       corrections.Set
	workers     int
}

func New(cfg Config) *Classifier {
	workers := cfg.Workers
	if workers <= 0 {
		workers = DefaultWorkers
	}
	return &Classifier{
		provider:    cfg.Provider,
		categories:  cfg.Categories,
		groups:      cfg.Groups,
		memberships: cfg.Memberships,
		known:       cfg.Known,
		workers:     workers,
	}
}

type Result struct {
	Transaction statements.Transaction
	Expense     float64 // probability the row is an expense
	Category    string
	// Group is the group the provider tagged the row with. The service
	// validates it against the category's memberships and falls back to a
	// legal group when the pair is not allowed.
	Group      string
	Confidence float64
	Source     Source
	Err        error
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

	// Credits are not shortcut to an "income" category: the provider decides
	// whether a row is salary, interest, a refund, or a transfer in, which is
	// what lets the budget find the salary row by its category.
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

	if len(c.memberships) > 0 {
		state["category_groups"] = c.memberships
	}

	questions := map[string]systemone.Question{
		qExpense: systemone.NoulWithCriteria(
			"This row is an expense: money left the account.",
			"The money_out field holds a non-zero amount.",
			"money_out is zero — the row is income or a transfer in.",
		),
		qCategory: systemone.Choice(categoryInstructions, c.categories),
	}

	if len(c.groups) > 0 {
		questions[qGroup] = systemone.Choice(
			"Which group does this transaction belong to? The state carries category_groups, a map from category key to the groups that category may be tagged with; choose one of the groups allowed for the category you picked. Use income when money came back against a spending category, for example a friend repaying their share of a bill.",
			c.groups,
		)
	}

	resp, err := c.provider.Decide(ctx, systemone.Request{
		State:     state,
		Questions: questions,
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
	if a, ok := resp.Answers[qGroup]; ok {
		res.Group = a.Choice
	}
	return res
}
