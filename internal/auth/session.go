// Package auth verifies better-auth session cookies so that non-Hono services
// (the Go HTTP API) can authenticate requests against the same Postgres session
// store used by the Node API.
//
// The cookie is a signed cookie emitted by better-call via better-auth's
// setSignedCookie: its value is "<sessionToken>.<base64 HMAC-SHA256>" and then
// URL-encoded as a whole. The session token (before the final dot, after
// verification) is the plaintext value stored in sessions.token.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strings"

	"expenny.co.za/internal/store/postgres"
)

// Distinct causes for a rejected session, so callers (and logs) can tell them
// apart instead of collapsing everything into a single 401.
var (
	ErrNoCookie        = errors.New("no session cookie present")
	ErrMalformedCookie = errors.New("session cookie is malformed")
	ErrBadSignature    = errors.New("session signature did not verify")
	ErrSessionNotFound = errors.New("session not found or expired")
)

// better-auth prefixes the cookie name with the configured cookiePrefix
// ("expenny" in api/src/lib/auth/better-auth.ts). When it decides it is running
// over https it prepends "__Secure-". We accept either so the same binary works
// in local (http) and deployed (https) environments.
var cookieNames = []string{
	"__Secure-expenny.session_token",
	"expenny.session_token",
}

// SessionVerifier resolves an authenticated user from a request's cookie.
type SessionVerifier struct {
	secret  string
	queries *postgres.Queries
}

func NewSessionVerifier(secret string, queries *postgres.Queries) *SessionVerifier {
	return &SessionVerifier{secret: secret, queries: queries}
}

// verifySignedValue reproduces better-call's getSignedCookie: URL-decode the
// value, split at the last dot, require a 44-char base64 signature ending in
// "=", then verify HMAC-SHA256 over the value that precedes the dot.
func (v *SessionVerifier) verifySignedValue(raw string) (string, error) {
	value, err := url.PathUnescape(raw)
	if err != nil {
		return "", ErrMalformedCookie
	}

	idx := strings.LastIndex(value, ".")
	if idx < 1 {
		return "", ErrMalformedCookie
	}

	token, signature := value[:idx], value[idx+1:]
	if len(signature) != 44 || !strings.HasSuffix(signature, "=") {
		return "", ErrMalformedCookie
	}

	got, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return "", ErrMalformedCookie
	}

	mac := hmac.New(sha256.New, []byte(v.secret))
	mac.Write([]byte(token))
	if !hmac.Equal(got, mac.Sum(nil)) {
		return "", ErrBadSignature
	}

	return token, nil
}

func (v *SessionVerifier) sessionToken(r *http.Request) (string, error) {
	present := make([]string, 0, len(cookieNames))
	for _, name := range cookieNames {
		if _, err := r.Cookie(name); err == nil {
			present = append(present, name)
		}
	}

	for _, name := range cookieNames {
		cookie, err := r.Cookie(name)
		if err != nil {
			continue
		}
		token, err := v.verifySignedValue(cookie.Value)
		if err != nil {
			return "", err
		}
		return token, nil
	}

	log.Printf("auth: no known session cookie; cookies present=%v", present)
	return "", ErrNoCookie
}

// User returns the authenticated user for the request. Failures are one of the
// sentinel errors above; any other failure (e.g. the database is down) is
// returned as-is so callers can distinguish a 401 from a 500.
func (v *SessionVerifier) User(ctx context.Context, r *http.Request) (postgres.User, error) {
	token, err := v.sessionToken(r)
	if err != nil {
		return postgres.User{}, err
	}

	session, err := v.queries.GetActiveSessionByToken(ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return postgres.User{}, ErrSessionNotFound
		}
		return postgres.User{}, err
	}

	user, err := v.queries.GetUserByID(ctx, session.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return postgres.User{}, ErrSessionNotFound
		}
		return postgres.User{}, err
	}

	return user, nil
}

type contextKey string

const userContextKey contextKey = "auth-user"

// RequireUser wraps a handler, rejecting unauthenticated requests with 401 and
// otherwise making the user available via UserFromContext. The 401 body carries
// the specific reason to make a POC debuggable; drop the reason for production.
func (v *SessionVerifier) RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, err := v.User(r.Context(), r)
		if err != nil {
			switch {
			case errors.Is(err, ErrNoCookie),
				errors.Is(err, ErrMalformedCookie),
				errors.Is(err, ErrBadSignature),
				errors.Is(err, ErrSessionNotFound):
				log.Printf("auth: rejecting request: %v", err)
				writeJSONError(w, http.StatusUnauthorized, err.Error())
			default:
				log.Printf("auth: session lookup failed: %v", err)
				writeJSONError(w, http.StatusInternalServerError, "internal error")
			}
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// UserFromContext returns the user populated by RequireUser.
func UserFromContext(ctx context.Context) (postgres.User, bool) {
	user, ok := ctx.Value(userContextKey).(postgres.User)
	return user, ok
}

func writeJSONError(w http.ResponseWriter, status int, reason string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":"unauthorized","reason":"` + reason + `"}`))
}
