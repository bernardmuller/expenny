package classifier

import (
	"context"
	"errors"
	"testing"
	"time"

	"expenny.co.za/internal/statements"
	"expenny.co.za/internal/systemone"
)

type stubProvider struct {
	calls    int
	last     systemone.Request
	response *systemone.Response
	err      error
}

func (s *stubProvider) Decide(_ context.Context, req systemone.Request) (*systemone.Response, error) {
	s.calls++
	s.last = req
	return s.response, s.err
}

func ptr(v float64) *float64 { return &v }

func TestClassifyCreditUsesProvider(t *testing.T) {
	// A credit used to be shortcut to a hardcoded "income" category, which
	// meant the provider could never choose Salary. The provider has to see
	// money-in rows so the budget can find the salary by its category.
	provider := &stubProvider{response: &systemone.Response{Answers: map[string]systemone.Answer{
		qExpense:  {Noul: ptr(0.05)},
		qCategory: {Choice: "salary", Confidence: ptr(0.95)},
	}}}

	c := New(Config{Provider: provider, Categories: map[string]string{"salary": "Salary"}})
	results := c.Classify(context.Background(), []statements.Transaction{
		{
			Description:     "Salary payment",
			TransactionDate: time.Date(2026, 10, 25, 0, 0, 0, 0, time.UTC),
			MoneyIn:         24000,
		},
	})

	if provider.calls != 1 {
		t.Fatalf("provider calls = %d, want 1", provider.calls)
	}
	if results[0].Category != "salary" || results[0].Source != SourceProvider {
		t.Errorf("result = %+v, want a provider salary", results[0])
	}
}

func TestClassifyAsksForTheGroup(t *testing.T) {
	provider := &stubProvider{response: &systemone.Response{Answers: map[string]systemone.Answer{
		qExpense:  {Noul: ptr(0.05)},
		qCategory: {Choice: "eating-out", Confidence: ptr(0.9)},
		qGroup:    {Choice: "income"},
	}}}

	c := New(Config{
		Provider:    provider,
		Categories:  map[string]string{"eating-out": "Eating out"},
		Groups:      map[string]string{"expenses": "Expenses", "income": "Income"},
		Memberships: map[string][]string{"eating-out": {"expenses", "income"}},
	})
	results := c.Classify(context.Background(), []statements.Transaction{
		{Description: "Split bill repayment", MoneyIn: 240},
	})

	if _, ok := provider.last.Questions[qGroup]; !ok {
		t.Error("provider was not asked for a group")
	}
	if _, ok := provider.last.State.(map[string]any)["category_groups"]; !ok {
		t.Error("memberships were not passed in state")
	}
	if results[0].Group != "income" {
		t.Errorf("group = %q, want income", results[0].Group)
	}
}

func TestClassifyFeeRuleSkipsProvider(t *testing.T) {
	provider := &stubProvider{err: errors.New("provider should not be called")}
	c := New(Config{Provider: provider, Categories: map[string]string{"bank-fees": "Bank fees"}})
	results := c.Classify(context.Background(), []statements.Transaction{
		{Description: "Service fee", Fee: 3},
	})

	if provider.calls != 0 {
		t.Fatalf("provider calls = %d, want 0", provider.calls)
	}
	if results[0].Category != FeeCategory || results[0].Source != SourceRule {
		t.Errorf("result = %+v, want the fee rule", results[0])
	}
}
