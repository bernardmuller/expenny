package application

import "testing"

func TestPoolerSafeURL(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "url without params",
			in:   "postgresql://user:pass@host:6543/db",
			want: "postgresql://user:pass@host:6543/db?binary_parameters=yes",
		},
		{
			name: "url keeps existing params",
			in:   "postgresql://user:pass@host:6543/db?sslmode=require",
			want: "postgresql://user:pass@host:6543/db?binary_parameters=yes&sslmode=require",
		},
		{
			name: "already enabled",
			in:   "postgresql://user:pass@host:6543/db?binary_parameters=yes",
			want: "postgresql://user:pass@host:6543/db?binary_parameters=yes",
		},
		{
			name: "key=value dsn is left alone",
			in:   "host=localhost port=5432 dbname=dev",
			want: "host=localhost port=5432 dbname=dev",
		},
		{
			name: "empty stays empty",
			in:   "",
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := poolerSafeURL(tt.in); got != tt.want {
				t.Errorf("poolerSafeURL(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
