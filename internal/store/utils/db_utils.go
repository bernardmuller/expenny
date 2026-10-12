package utils

import (
	"database/sql"
	"strconv"
	"time"

	"github.com/google/uuid"
)

func NullString(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}

func NullFloat(v *float64) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: strconv.FormatFloat(*v, 'f', 2, 64), Valid: true}
}

func NullRatio(v *float64) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: strconv.FormatFloat(*v, 'f', 3, 64), Valid: true}
}

func NullBool(b *bool) sql.NullBool {
	if b == nil {
		return sql.NullBool{}
	}
	return sql.NullBool{Bool: *b, Valid: true}
}

func NullUUID(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func NullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}

// OptionalString turns an empty string into a nil pointer, so a statement
// column that was blank is stored as NULL rather than the empty string.
func OptionalString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// OptionalFloat turns a zero amount into a nil pointer. It relies on the CSV
// parser using zero as its representation of an absent amount, which loses the
// distinction between a blank balance and a genuine 0.00.
func OptionalFloat(v float64) *float64 {
	if v == 0 {
		return nil
	}
	return &v
}
