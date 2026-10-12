package corrections

import (
	"path/filepath"
	"testing"
)

func TestNormalise(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "strips card number and reference token",
			in:   "Checkers Sb168189 (Card 5628)",
			want: "checkers",
		},
		{
			name: "pending prefix falls out with the brackets",
			in:   "(Pending) Checkers Sb168189 (Card 5628)",
			want: "checkers",
		},
		{
			name: "same merchant on a different card collapses to one key",
			in:   "Checkers Sb168189 (Card 6872)",
			want: "checkers",
		},
		{
			name: "closes the gap a removed bracket leaves before a colon",
			in:   "Recurring Payment (23637311): Rent",
			want: "recurring payment: rent",
		},
		{
			name: "drops two bracketed references in one description",
			in:   "DebiCheck Debit Order (3397946158): Capfuneral (CF66708487)",
			want: "debicheck debit order: capfuneral",
		},
		{
			name: "keeps digits that are part of a name",
			in:   "Immediate Capitec Pay Payment: Sixty60 2253612",
			want: "immediate capitec pay payment: sixty60",
		},
		{
			name: "keeps a merchant whose name contains a dot and digits",
			in:   "International Processing Fee: Boot.dev Education",
			want: "international processing fee: boot.dev education",
		},
		{
			name: "keeps a plain description untouched beyond casing",
			in:   "Monthly Account Admin Fee",
			want: "monthly account admin fee",
		},
		{
			name: "collapses the whitespace padding some rows carry",
			in:   "  Woolworths   Cape Town (Card 5628)  ",
			want: "woolworths cape town",
		},
		{
			name: "empty description stays empty",
			in:   "",
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Normalise(tt.in); got != tt.want {
				t.Errorf("Normalise(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestLoadMissingFileIsEmpty(t *testing.T) {
	got, err := Load(filepath.Join(t.TempDir(), "does-not-exist.json"))
	if err != nil {
		t.Fatalf("Load() on a missing file returned %v, want nil", err)
	}
	if len(got) != 0 {
		t.Errorf("Load() on a missing file returned %v, want an empty set", got)
	}
}

func TestSaveLoadRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "jev", "corrections.json")

	want := Set{"checkers": "groceries", "recurring payment: rent": "rent"}
	if err := want.Save(path); err != nil {
		t.Fatalf("Save() returned %v", err)
	}

	got, err := Load(path)
	if err != nil {
		t.Fatalf("Load() returned %v", err)
	}

	if len(got) != len(want) {
		t.Fatalf("Load() returned %d entries, want %d", len(got), len(want))
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("Load()[%q] = %q, want %q", k, got[k], v)
		}
	}
}
