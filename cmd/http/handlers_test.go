package main

import (
	"database/sql"
	"testing"

	"github.com/google/uuid"

	"expenny.co.za/internal/classifications"
	"expenny.co.za/internal/store/postgres"
)

func nullString(s string) sql.NullString { return sql.NullString{String: s, Valid: true} }

func classifiedRow(confidence, source string) postgres.GetClassifiedStatementTransactionsByUserIdRow {
	row := postgres.GetClassifiedStatementTransactionsByUserIdRow{
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
	}
	if confidence != "" {
		row.Confidence = nullString(confidence)
	}
	return row
}

func TestNeedsReview(t *testing.T) {
	tests := []struct {
		name string
		row  postgres.GetClassifiedStatementTransactionsByUserIdRow
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
			row:  postgres.GetClassifiedStatementTransactionsByUserIdRow{ID: uuid.New()},
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
	rows := []postgres.GetClassifiedStatementTransactionsByUserIdRow{
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
