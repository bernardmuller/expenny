package services

import "testing"

func TestNormalizeCategoryInput(t *testing.T) {
	tests := []struct {
		name    string
		in      CategoryInput
		wantKey string
		wantErr bool
	}{
		{
			name:    "trims and lowercases",
			in:      CategoryInput{Key: "  Eating-Out ", Label: " Eating out ", Icon: " 🍔 "},
			wantKey: "eating-out",
		},
		{
			name:    "rejects an empty key",
			in:      CategoryInput{Key: "", Label: "Fuel"},
			wantErr: true,
		},
		{
			name:    "rejects an empty label",
			in:      CategoryInput{Key: "fuel", Label: "  "},
			wantErr: true,
		},
		{
			name:    "rejects spaces and punctuation in the key",
			in:      CategoryInput{Key: "fuel pump!", Label: "Fuel"},
			wantErr: true,
		},
		{
			name:    "rejects an oversized icon",
			in:      CategoryInput{Key: "fuel", Label: "Fuel", Icon: "🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeCategoryInput(tt.in)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeCategoryInput() error = %v", err)
			}
			if got.Key != tt.wantKey {
				t.Errorf("key = %q, want %q", got.Key, tt.wantKey)
			}
		})
	}
}

func TestNormalizeGroupInput(t *testing.T) {
	key, label, err := normalizeGroupInput("  Income ", " Income ")
	if err != nil {
		t.Fatalf("normalizeGroupInput() error = %v", err)
	}
	if key != "income" || label != "Income" {
		t.Errorf("got (%q, %q), want (income, Income)", key, label)
	}

	if _, _, err := normalizeGroupInput("bad key", "Label"); err == nil {
		t.Error("expected an error for a key with a space")
	}
	if _, _, err := normalizeGroupInput("key", ""); err == nil {
		t.Error("expected an error for an empty label")
	}
}
