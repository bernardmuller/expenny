package services

import "testing"

func TestParseAndFormatAmount(t *testing.T) {
	if got := formatAmount(parseAmount("19368.5") - parseAmount("4632.00")); got != "14736.50" {
		t.Errorf("formatAmount(parseAmount(...)) = %q, want 14736.50", got)
	}
	if got := parseAmount("not a number"); got != 0 {
		t.Errorf("parseAmount(garbage) = %v, want 0", got)
	}
}
