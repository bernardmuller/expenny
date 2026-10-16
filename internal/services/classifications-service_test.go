package services

import "testing"

func TestResolveGroup(t *testing.T) {
	tests := []struct {
		name      string
		chosen    string
		allowed   []string
		isExpense bool
		want      string
	}{
		{
			name:      "keeps a legal choice",
			chosen:    "income",
			allowed:   []string{"expenses", "income"},
			isExpense: false,
			want:      "income",
		},
		{
			name:      "falls back to expenses when the row is money out",
			chosen:    "transfers",
			allowed:   []string{"expenses", "income"},
			isExpense: true,
			want:      "expenses",
		},
		{
			name:      "falls back to income when the row is money in",
			chosen:    "transfers",
			allowed:   []string{"expenses", "income"},
			isExpense: false,
			want:      "income",
		},
		{
			name:      "falls back to the first membership when direction is not allowed",
			chosen:    "income",
			allowed:   []string{"recurring", "transfers"},
			isExpense: true,
			want:      "recurring",
		},
		{
			name:      "no memberships means no group",
			chosen:    "income",
			allowed:   nil,
			isExpense: false,
			want:      "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := resolveGroup(tt.chosen, tt.allowed, tt.isExpense); got != tt.want {
				t.Errorf("resolveGroup() = %q, want %q", got, tt.want)
			}
		})
	}
}
