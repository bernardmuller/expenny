package utils

func Optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
