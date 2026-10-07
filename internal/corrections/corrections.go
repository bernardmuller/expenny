// Package corrections stores the categories a human has confirmed for statement
// rows, so a classifier doesn't have to guess at the same merchant twice.
//
// Entries are keyed by a normalised form of the row's description rather than
// the description itself. A statement writes the same merchant many different
// ways — card numbers, reference numbers and a "(Pending)" prefix all vary from
// one visit to the next — so keying on the raw text would mean correcting
// Checkers once per card in the wallet. See Normalise.
package corrections

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Set maps a normalised description to a category key.
type Set map[string]string

var (
	// parenGroup matches a bracketed aside: "(Card 5628)", "(3397946158)",
	// "(Pending)". None of them identify the merchant.
	parenGroup = regexp.MustCompile(`\([^)]*\)`)

	// reference matches a run of four or more digits, which is what separates a
	// reference number from a digit that is part of a name. The threshold
	// matters: "Sixty60" and "Boot.dev" have to survive, while "Sb168189" and
	// "2253612" must not.
	reference = regexp.MustCompile(`\d{4,}`)

	// spaceBeforePunct cleans up the gap a removed bracket leaves behind, as in
	// "Recurring Payment (23637311): Rent".
	spaceBeforePunct = regexp.MustCompile(`\s+([:,.])`)
)

// Normalise reduces a statement description to a stable merchant key.
//
//	"Checkers Sb168189 (Card 5628)"            -> "checkers"
//	"(Pending) Checkers Sb168189 (Card 6872)"  -> "checkers"
//	"Recurring Payment (23637311): Rent"       -> "recurring payment: rent"
//
// The result is lossy by design — it is a grouping key, not a description. The
// row's original text is kept in the statement, so nothing is lost that matters.
func Normalise(description string) string {
	s := strings.ToLower(description)
	s = parenGroup.ReplaceAllString(s, " ")

	// Drop reference-number tokens whole; trimming just the digits would leave
	// behind stubs like "sb" that are no more meaningful.
	fields := strings.Fields(s)
	kept := make([]string, 0, len(fields))
	for _, f := range fields {
		if reference.MatchString(f) {
			continue
		}
		kept = append(kept, f)
	}

	s = strings.Join(kept, " ")
	s = spaceBeforePunct.ReplaceAllString(s, "$1")
	return strings.Trim(s, " :,.-")
}

// Load reads the corrections at path. A file that isn't there yet is an empty
// set rather than an error — the first review session is expected to create it.
func Load(path string) (Set, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Set{}, nil
		}
		return nil, fmt.Errorf("failed to read %s: %w", path, err)
	}

	s := Set{}
	if err := json.Unmarshal(b, &s); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", path, err)
	}
	return s, nil
}

// Save writes the set to path, creating the directory if it doesn't exist. The
// output is indented and map keys are sorted by encoding/json, so the file stays
// readable and diffs cleanly when it's committed.
func (s Set) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("failed to create %s: %w", filepath.Dir(path), err)
	}

	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode corrections: %w", err)
	}

	if err := os.WriteFile(path, append(b, '\n'), 0o644); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, err)
	}
	return nil
}
