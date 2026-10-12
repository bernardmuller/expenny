package auth

import (
	"testing"
)

// testSecret and the cookie below were produced with Node's crypto using the
// exact algorithm better-call uses (HMAC-SHA256 over the raw token, standard
// base64, then encodeURIComponent over "token.signature"):
//
//	crypto.createHmac("sha256", "test-secret").update("abc123token").digest("base64")
//
// This guards against drift in the cookie format we depend on.
const (
	testSecret = "test-secret"
	// "abc123token.FMGPeijjF9PiGYaZcxhrHRBrkdSpz0EHB6ywIgaMnLw%3D"
	testCookie = "abc123token.FMGPeijjF9PiGYaZcxhrHRBrkdSpz0EHB6ywIgaMnLw%3D"

	// A second vector whose base64 signature contains "+", which better-call
	// encodes as %2B. Guards against using url.QueryUnescape (which would turn a
	// literal "+" into a space) instead of decodeURIComponent semantics.
	//   crypto.createHmac("sha256", "test-secret").update("tok1").digest("base64")
	//   => "5Hs+no11QFlIQUEFN7Q+b43R7EoVIZEcoDf0ncco9qQ="
	plusCookie = "tok1.5Hs%2Bno11QFlIQUEFN7Q%2Bb43R7EoVIZEcoDf0ncco9qQ%3D"
)

func TestVerifySignedValueAcceptsValidCookie(t *testing.T) {
	v := &SessionVerifier{secret: testSecret}

	token, err := v.verifySignedValue(testCookie)
	if err != nil {
		t.Fatalf("expected valid cookie, got error: %v", err)
	}
	if token != "abc123token" {
		t.Fatalf("expected token %q, got %q", "abc123token", token)
	}
}

func TestVerifySignedValueAcceptsPlusInSignature(t *testing.T) {
	v := &SessionVerifier{secret: testSecret}

	token, err := v.verifySignedValue(plusCookie)
	if err != nil {
		t.Fatalf("expected valid cookie, got error: %v", err)
	}
	if token != "tok1" {
		t.Fatalf("expected token %q, got %q", "tok1", token)
	}
}

func TestVerifySignedValueRejectsTampering(t *testing.T) {
	v := &SessionVerifier{secret: testSecret}

	cases := map[string]string{
		"tampered token":    "evil123token.FMGPeijjF9PiGYaZcxhrHRBrkdSpz0EHB6ywIgaMnLw%3D",
		"wrong secret":      "abc123token.FMGPeijjF9PiGYaZcxhrHRBrkdSpz0EHB6ywIgaMnLw%3D",
		"no signature":      "abc123token",
		"short signature":   "abc123token.FMGPeijjF9PiGYaZcxhrHRBrkdSpz0EHB6yw%3D",
		"missing padding":   "abc123token.FMGPeijjF9PiGYaZcxhrHRBrkdSpz0EHB6ywIgaMnLw",
		"garbage signature": "abc123token.!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!=",
	}

	for name, cookie := range cases {
		t.Run(name, func(t *testing.T) {
			verifier := v
			if name == "wrong secret" {
				verifier = &SessionVerifier{secret: "other-secret"}
			}
			if _, err := verifier.verifySignedValue(cookie); err == nil {
				t.Fatalf("expected rejection for %q", cookie)
			}
		})
	}
}
