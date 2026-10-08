package utils

import (
	"database/sql"
	"strconv"
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
