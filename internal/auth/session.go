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

var (
	ErrNoCookie        = errors.New("no session cookie present")
	ErrMalformedCookie = errors.New("session cookie is malformed")
	ErrBadSignature    = errors.New("session signature did not verify")
	ErrSessionNotFound = errors.New("session not found or expired")
)

var cookieNames = []string{
	"__Secure-expenny.session_token",
	"expenny.session_token",
}

type SessionVerifier struct {
	secret  string
	queries *postgres.Queries
}

func NewSessionVerifier(secret string, queries *postgres.Queries) *SessionVerifier {
	return &SessionVerifier{secret: secret, queries: queries}
}

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

func UserFromContext(ctx context.Context) (postgres.User, bool) {
	user, ok := ctx.Value(userContextKey).(postgres.User)
	return user, ok
}

func writeJSONError(w http.ResponseWriter, status int, reason string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":"unauthorized","reason":"` + reason + `"}`))
}
