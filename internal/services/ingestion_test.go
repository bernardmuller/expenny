package services

import (
	"strconv"
	"testing"

	"github.com/google/uuid"

	"expenny.co.za/internal/statements"
	"expenny.co.za/internal/store/postgres"
)

func TestIsPendingDescription(t *testing.T) {
	tests := []struct {
		description string
		want        bool
	}{
		{"(Pending) Checkers Sb168189 (Card 5628)", true},
		{"Checkers Sb168189 (Card 5628) (pending)", true},
		{"(pending) checkers", true},
		{"Checkers Sb168189 (Card 5628)", false},
		{"Pending Payment Transfer", false},
	}

	for _, tt := range tests {
		if got := isPendingDescription(tt.description); got != tt.want {
			t.Errorf("isPendingDescription(%q) = %v, want %v", tt.description, got, tt.want)
		}
	}
}

func TestDescriptionWithoutPendingTag(t *testing.T) {
	tests := []struct {
		description string
		want        string
	}{
		{"(Pending) Steam Games Bellevue (Card 6872)", "Steam Games Bellevue (Card 6872)"},
		{"Steam Games Bellevue (Card 6872) (Pending)", "Steam Games Bellevue (Card 6872)"},
		{"Steam Games Bellevue (Card 6872)", "Steam Games Bellevue (Card 6872)"},
	}

	for _, tt := range tests {
		if got := descriptionWithoutPendingTag(tt.description); got != tt.want {
			t.Errorf("descriptionWithoutPendingTag(%q) = %q, want %q", tt.description, got, tt.want)
		}
	}
}

func TestSameMerchantName(t *testing.T) {
	tests := []struct {
		name string
		a    string
		b    string
		want bool
	}{
		{
			name: "the tag is ignored",
			a:    "Steam Games Bellevue (Card 6872)",
			b:    "(Pending) Steam Games Bellevue (Card 6872)",
			want: true,
		},
		{
			name: "card numbers vary between the copies",
			a:    "Checkers Sb168189 (Card 5628)",
			b:    "(Pending) Checkers Sb168189 (Card 6872)",
			want: true,
		},
		{
			name: "the cleared copy keeps a transaction-type prefix",
			a:    "Online Purchase: Steam Games Bellevue (Card 6872)",
			b:    "(Pending) Steam Games Bellevue (Card 6872)",
			want: true,
		},
		{
			name: "another merchant",
			a:    "Woolworths Food (Card 5628)",
			b:    "(Pending) Checkers Sb168189 (Card 5628)",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := sameMerchantName(tt.a, tt.b); got != tt.want {
				t.Errorf("sameMerchantName(%q, %q) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestClearsPending(t *testing.T) {
	const account = "1594035723"

	cleared := func(description string, moneyOut float64) statements.Transaction {
		return statements.Transaction{
			Account:     account,
			Description: description,
			MoneyOut:    moneyOut,
		}
	}
	pending := func(description string, moneyOut float64) postgres.StatementTransaction {
		return postgres.StatementTransaction{
			ID:          uuid.New(),
			Account:     account,
			Description: description,
			MoneyIn:     "0.00",
			MoneyOut:    strconv.FormatFloat(moneyOut, 'f', 2, 64),
			Fee:         "0.00",
		}
	}

	tests := []struct {
		name    string
		cleared statements.Transaction
		pending postgres.StatementTransaction
		want    bool
	}{
		{
			name:    "same payment without the tag",
			cleared: cleared("Steam Games Bellevue (Card 6872)", -453.60),
			pending: pending("(Pending) Steam Games Bellevue (Card 6872)", -453.60),
			want:    true,
		},
		{
			name:    "card number may differ",
			cleared: cleared("Checkers Sb168189 (Card 5628)", -389.46),
			pending: pending("(Pending) Checkers Sb168189 (Card 6872)", -389.46),
			want:    true,
		},
		{
			name:    "cleared copy keeps the transaction prefix",
			cleared: cleared("Online Purchase: Steam Games Bellevue (Card 6872)", -453.60),
			pending: pending("(Pending) Steam Games Bellevue (Card 6872)", -453.60),
			want:    true,
		},
		{
			name:    "another purchase at the same merchant",
			cleared: cleared("Checkers Sb168189 (Card 5628)", -150.00),
			pending: pending("(Pending) Checkers Sb168189 (Card 5628)", -389.46),
			want:    false,
		},
		{
			name:    "another merchant",
			cleared: cleared("Woolworths Food (Card 5628)", -389.46),
			pending: pending("(Pending) Checkers Sb168189 (Card 5628)", -389.46),
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := clearsPending(tt.cleared, tt.pending); got != tt.want {
				t.Errorf("clearsPending() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCollidedPendingRowsProtectsReusedRows(t *testing.T) {
	const cleared = "Online Purchase: Steam Games Bellevue (Card 6872)"

	reusedID := uuid.New()
	txns := []statements.Transaction{
		{Description: cleared},
		{Description: cleared},
	}
	rows := []postgres.StatementTransaction{
		{ID: reusedID, Description: "(Pending) Steam Games Bellevue (Card 6872)"},
		{ID: uuid.New(), Description: cleared},
	}

	protected := collidedPendingRows(txns, rows)

	if !protected[reusedID] {
		t.Fatal("the pending row the dedup hash reused should be protected from deletion")
	}
	if len(protected) != 1 {
		t.Fatalf("protected %d rows, want 1", len(protected))
	}
}
