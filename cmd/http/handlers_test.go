package main

import (
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/classifications"
	"expenny.co.za/internal/classifier"
	"expenny.co.za/internal/services"
	"expenny.co.za/internal/store/postgres"
)

func nullString(s string) sql.NullString { return sql.NullString{String: s, Valid: true} }

func classifiedRow(confidence, source string) postgres.GetClassifiedStatementTransactionsByUserIdPageRow {
	row := postgres.GetClassifiedStatementTransactionsByUserIdPageRow{
		ID:                  uuid.New(),
		Description:         "POS PURCHASE ENGEN 1STOP N1 CITY",
		OriginalDescription: "ENGEN 1STOP",
		MoneyIn:             "0.00",
		MoneyOut:            "874.00",
		Fee:                 "0.00",
		ClassificationID:    uuid.NullUUID{UUID: uuid.New(), Valid: true},
		IsExpense:           sql.NullBool{Bool: true, Valid: true},
		ExpenseProb:         nullString("0.930"),
		Source:              sql.NullString{String: source, Valid: true},
		CategoryID:          uuid.NullUUID{UUID: uuid.New(), Valid: true},
		CategoryKey:         nullString("transport-fuel"),
		CategoryLabel:       nullString("Transport & Fuel"),
		CategoryIcon:        nullString("🚗"),
		ClassificationGroup: nullString("expenses"),
	}
	if confidence != "" {
		row.Confidence = nullString(confidence)
	}
	return row
}

func TestNeedsReview(t *testing.T) {
	tests := []struct {
		name string
		row  postgres.GetClassifiedStatementTransactionsByUserIdPageRow
		want bool
	}{
		{
			name: "provider below the threshold needs a human",
			row:  classifiedRow("0.760", "provider"),
			want: true,
		},
		{
			name: "provider at the threshold is trusted",
			row:  classifiedRow("0.800", "provider"),
			want: false,
		},
		{
			name: "human decision is never reviewed again",
			row:  classifiedRow("0.200", classifications.SourceHuman),
			want: false,
		},
		{
			name: "rule fires with full confidence",
			row:  classifiedRow("1.000", "rule"),
			want: false,
		},
		{
			name: "classification without confidence still needs a human",
			row:  classifiedRow("", "provider"),
			want: true,
		},
		{
			name: "unclassified row needs a human",
			row:  postgres.GetClassifiedStatementTransactionsByUserIdPageRow{ID: uuid.New()},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := needsReview(tt.row); got != tt.want {
				t.Errorf("needsReview() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestToTransactionResponses(t *testing.T) {
	rows := []postgres.GetClassifiedStatementTransactionsByUserIdPageRow{
		classifiedRow("0.760", "provider"),
		{ID: uuid.New(), Description: "Mystery", MoneyIn: "0.00", MoneyOut: "1.00", Fee: "0.00"},
	}

	out := toTransactionResponses(rows)
	if len(out) != 2 {
		t.Fatalf("got %d transactions, want 2", len(out))
	}

	first := out[0]
	if first.Classification == nil {
		t.Fatal("first transaction is missing its classification")
	}
	if first.Classification.Category == nil || first.Classification.Category.Key != "transport-fuel" {
		t.Errorf("first classification category = %+v, want transport-fuel", first.Classification.Category)
	}
	if first.Classification.Confidence == nil || *first.Classification.Confidence != 0.76 {
		t.Errorf("first confidence = %v, want 0.76", first.Classification.Confidence)
	}
	if first.Classification.Group == nil || *first.Classification.Group != "expenses" {
		t.Errorf("first group = %v, want expenses", first.Classification.Group)
	}
	if !first.NeedsReview {
		t.Error("first transaction should need review")
	}

	second := out[1]
	if second.Classification != nil {
		t.Errorf("second classification = %+v, want nil", second.Classification)
	}
	if !second.NeedsReview {
		t.Error("unclassified transaction should need review")
	}
}

func TestClampedInt(t *testing.T) {
	tests := []struct {
		name     string
		raw      string
		fallback int
		min      int
		max      int
		want     int
	}{
		{name: "empty uses the fallback", raw: "", fallback: 20, min: 1, max: 100, want: 20},
		{name: "parses a valid value", raw: "50", fallback: 20, min: 1, max: 100, want: 50},
		{name: "non-numeric uses the fallback", raw: "nope", fallback: 20, min: 1, max: 100, want: 20},
		{name: "below the minimum uses the fallback", raw: "0", fallback: 20, min: 1, max: 100, want: 20},
		{name: "above the maximum uses the fallback", raw: "101", fallback: 20, min: 1, max: 100, want: 20},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := clampedInt(tt.raw, tt.fallback, tt.min, tt.max); got != tt.want {
				t.Errorf("clampedInt(%q) = %d, want %d", tt.raw, got, tt.want)
			}
		})
	}
}

func TestClassifyNeedsReview(t *testing.T) {
	tests := []struct {
		name   string
		result classifier.Result
		want   bool
	}{
		{name: "a rule never needs review", result: classifier.Result{Source: classifier.SourceRule, Confidence: 1}, want: false},
		{name: "a confident provider decision does not", result: classifier.Result{Source: classifier.SourceProvider, Confidence: 0.9}, want: false},
		{name: "a shaky provider decision does", result: classifier.Result{Source: classifier.SourceProvider, Confidence: 0.5}, want: true},
		{name: "a failed classification does", result: classifier.Result{Err: errors.New("provider down")}, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := classifyNeedsReview(tt.result); got != tt.want {
				t.Errorf("classifyNeedsReview() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseBudgetDay(t *testing.T) {
	parsed, err := parseBudgetDay("2026-10-01")
	if err != nil {
		t.Fatalf("parseBudgetDay() error = %v", err)
	}
	if parsed.Day() != 1 || parsed.Month() != 10 || parsed.Year() != 2026 {
		t.Errorf("parseBudgetDay() = %v, want 2026-10-01", parsed)
	}

	if _, err := parseBudgetDay("01/10/2026"); err == nil {
		t.Error("parseBudgetDay() accepted a non-ISO date")
	}
}

func TestToCategoryResponses(t *testing.T) {
	expensesID := uuid.New()
	incomeID := uuid.New()

	out := toCategoryResponses([]services.CategoryView{
		{
			ID: uuid.New(), Key: "eating-out", Label: "Eating out", Icon: "🍔",
			Groups: []services.CategoryGroupView{
				{ID: expensesID, Key: "expenses", Label: "Expenses"},
				{ID: incomeID, Key: "income", Label: "Income"},
			},
		},
		{ID: uuid.New(), Key: "misc", Label: "Misc", Icon: "📎", Groups: []services.CategoryGroupView{}},
	})

	if len(out) != 2 {
		t.Fatalf("got %d categories, want 2", len(out))
	}
	if len(out[0].Groups) != 2 {
		t.Fatalf("got %d groups for eating-out, want 2", len(out[0].Groups))
	}
	if out[0].Groups[0].ID != expensesID.String() || out[0].Groups[1].ID != incomeID.String() {
		t.Errorf("groups = %+v, want the expenses and income ids", out[0].Groups)
	}
	if out[1].Groups == nil || len(out[1].Groups) != 0 {
		t.Errorf("ungrouped category groups = %+v, want an empty slice", out[1].Groups)
	}
}

func TestToBudgetResponse(t *testing.T) {
	balance := "4632.00"
	salary := "24000.00"
	spent := "19368.00"
	account := "1594035723"
	salaryID := uuid.New()
	start := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC)

	body := toBudgetResponse(services.BudgetOverview{
		Preferences: &services.BudgetPreference{
			Account:   &account,
			StartDate: start,
			EndDate:   end,
		},
		CurrentBalance: &balance,
		SalaryAmount:   &salary,
		SpentAmount:    &spent,
		Salary: &services.BudgetSalary{
			ID:                  salaryID,
			Description:         "Salary",
			OriginalDescription: "SALARY PAYMENT",
			TransactionDate:     start,
			Amount:              salary,
		},
		Accounts: []string{account},
	})

	if body.Preferences == nil {
		t.Fatal("preferences missing")
	}
	if body.Preferences.StartDate != "2026-10-01" || body.Preferences.EndDate != "2026-10-31" {
		t.Errorf("preferences = %+v, want ISO dates", body.Preferences)
	}
	if body.SalaryTransaction == nil || body.SalaryTransaction.ID != salaryID.String() {
		t.Errorf("salary transaction = %+v, want the classified salary row", body.SalaryTransaction)
	}
	if len(body.Accounts) != 1 {
		t.Errorf("accounts = %v, want one entry", body.Accounts)
	}

	empty := toBudgetResponse(services.BudgetOverview{})
	if empty.Accounts == nil {
		t.Error("accounts should serialise as an empty array, not null")
	}
	if empty.Preferences != nil || empty.SalaryTransaction != nil {
		t.Errorf("empty overview = %+v, want no preferences or salary", empty)
	}
}
