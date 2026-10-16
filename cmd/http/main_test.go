package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWithCORSSetsHeaders(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	tests := []struct {
		name       string
		method     string
		origin     string
		wantStatus int
		wantAllow  string
	}{
		{
			name:       "reflects the request origin",
			method:     http.MethodGet,
			origin:     "https://expenny.co.za",
			wantStatus: http.StatusOK,
			wantAllow:  "https://expenny.co.za",
		},
		{
			name:       "answers a preflight",
			method:     http.MethodOptions,
			origin:     "https://expenny.co.za",
			wantStatus: http.StatusNoContent,
			wantAllow:  "https://expenny.co.za",
		},
		{
			name:       "no origin means no allow-origin header",
			method:     http.MethodGet,
			wantStatus: http.StatusOK,
			wantAllow:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/v2/budget", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			rec := httptest.NewRecorder()
			withCORS(ok).ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tt.wantAllow {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, tt.wantAllow)
			}
			// The response has to vary on Origin even when this request did
			// not carry one, or a cache can serve it to a browser later.
			if got := rec.Header().Get("Vary"); !strings.Contains(got, "Origin") {
				t.Errorf("Vary = %q, want it to contain Origin", got)
			}
		})
	}
}

func TestRecoverPanicsKeepsCORSHeaders(t *testing.T) {
	panicking := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	})

	req := httptest.NewRequest(http.MethodGet, "/v2/budget", nil)
	req.Header.Set("Origin", "https://expenny.co.za")
	rec := httptest.NewRecorder()
	withCORS(recoverPanics(panicking)).ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://expenny.co.za" {
		t.Errorf("Access-Control-Allow-Origin = %q, want the request origin", got)
	}
	if body := rec.Body.String(); !strings.Contains(body, "internal server error") {
		t.Errorf("body = %q, want the error body", body)
	}
}
