// Package jev is a client for the Jev decision API.
//
// Jev is a decision model rather than a text model: you send it some application
// state plus a map of typed questions, and it answers each one with a type —
// a choice, a score, or a yes/no probability — along with calibrated
// probabilities, instead of generated prose. Questions are answered in parallel,
// so batching them into one request is cheaper than asking one at a time.
//
// Usage:
//
//	c := jev.New(os.Getenv("JEV_API_KEY"))
//	resp, err := c.Decide(ctx, jev.Request{
//		State: "Checkout returns a blank page after clicking Pay.",
//		Questions: map[string]jev.Question{
//			"is_bug": jev.Noul("Is the customer reporting a software defect?"),
//		},
//	})
package jev

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	// DefaultBaseURL is the Jev gateway origin.
	DefaultBaseURL = "https://api.defapi.org"

	// DefaultModel is the model Decide uses when Request.Model is empty.
	DefaultModel = "typesafe/jev-1.13"

	decisionsPath = "/api/v1/decisions"
)

// Question types.
const (
	TypeChoice = "choice"
	TypeScore  = "score"
	TypeNoul   = "noul"
)

// Client talks to the Jev API. The zero value is not usable — call New.
//
// BaseURL and HTTPClient are exported so tests can point the client at an
// httptest server; New fills both with working defaults.
type Client struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
}

// New returns a Client that authenticates with apiKey and talks to the public
// gateway.
func New(apiKey string) *Client {
	return &Client{
		APIKey:     apiKey,
		BaseURL:    DefaultBaseURL,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Request is one call to the decision API. Every field is required, though
// Decide fills Model with DefaultModel when it is empty.
type Request struct {
	Model string `json:"model"`
	// State is the context being judged. A plain string is fine; a struct or
	// map is encoded as a JSON object, which is the better shape when the
	// context has distinct fields.
	State     any                 `json:"state"`
	Questions map[string]Question `json:"questions"`
}

// Question is a single typed judgement to make about the state.
//
// Criteria is shaped by Type — a map of option to description for choice, an
// ordered slice of level descriptions for score, an optional true/false map for
// noul. Prefer the Choice, Score and Noul constructors over filling it in by
// hand.
type Question struct {
	Type         string `json:"type"`
	Instructions any    `json:"instructions"`
	Criteria     any    `json:"criteria,omitempty"`
}

// Choice builds a question that picks one of options, keyed by the value that
// comes back in Answer.Choice. The API caps options at 255.
func Choice(instructions string, options map[string]string) Question {
	return Question{Type: TypeChoice, Instructions: instructions, Criteria: options}
}

// Score builds a question that rates the state against an ordered scale, from
// the lowest level to the highest. The API accepts between 2 and 10 levels.
func Score(instructions string, levels ...string) Question {
	return Question{Type: TypeScore, Instructions: instructions, Criteria: levels}
}

// Noul builds a yes/no question. Phrase instructions so that yes is the high
// end — "Does this contain personal data?" reads better than its negation.
func Noul(instructions string) Question {
	return Question{Type: TypeNoul, Instructions: instructions}
}

// NoulWithCriteria is Noul with explicit descriptions of what counts as yes and
// what counts as no, which helps when the boundary is subtle.
func NoulWithCriteria(instructions, whenTrue, whenFalse string) Question {
	return Question{
		Type:         TypeNoul,
		Instructions: instructions,
		Criteria:     map[string]string{"true": whenTrue, "false": whenFalse},
	}
}

// Response is a successful decision, with one entry in Answers per question in
// the request, under the same key.
type Response struct {
	ID       string            `json:"id"`
	Model    string            `json:"model"`
	Provider string            `json:"provider"`
	Answers  map[string]Answer `json:"answers"`
	Usage    Usage             `json:"usage"`
	TaskID   string            `json:"task_id"`
	// Consumed repeats Usage.Cost as a string; kept for parity with the wire
	// format.
	Consumed string `json:"consumed"`
}

// Usage reports what the request cost. Output tokens are not billed.
type Usage struct {
	InputTokens  int     `json:"input_tokens"`
	OutputTokens int     `json:"output_tokens"`
	Cost         float64 `json:"cost"`
}

// Answer carries whichever fields the question's type produces; the rest stay
// zero. Switch on Type before reading them.
//
// Noul, Score and Confidence are pointers because 0 is a meaningful answer and
// has to stay distinguishable from a field the model did not return.
type Answer struct {
	Type string `json:"type"`

	// Noul is set for TypeNoul: the probability of yes, from 0 to 1. It needs
	// no separate confidence — a value near 0.5 is itself the uncertainty.
	Noul *float64 `json:"noul,omitempty"`

	// Choice is set for TypeChoice: the key of the winning option.
	Choice string `json:"choice,omitempty"`

	// Score is set for TypeScore: the probability-weighted level index, so it
	// is usually fractional. Legend maps those indices back to their
	// descriptions.
	Score  *float64          `json:"score,omitempty"`
	Legend map[string]string `json:"legend,omitempty"`

	Confidence    *float64           `json:"confidence,omitempty"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
}

// APIError is the error body the gateway returns on any non-200. It is a typed
// error so callers can tell a bad key or malformed request (fail fast) from a
// rate limit or an overloaded upstream (worth retrying).
type APIError struct {
	Status  int    `json:"-"`
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

func (e *APIError) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("jev: %d %s: %s", e.Status, e.Message, e.Detail)
	}
	return fmt.Sprintf("jev: %d %s", e.Status, e.Message)
}

// Decide sends req and returns the typed answers. A non-200 response comes back
// as an *APIError.
func (c *Client) Decide(ctx context.Context, req Request) (*Response, error) {
	if req.Model == "" {
		req.Model = DefaultModel
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to encode request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+decisionsPath, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to build decisions request: %w", err)
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("decisions request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, decodeError(resp)
	}

	var out Response
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("failed to decode decisions response: %w", err)
	}
	return &out, nil
}

// decodeError turns a non-200 into an *APIError, falling back to the raw body
// when the response didn't come from the application itself — a proxy timing
// out in front of the gateway returns HTML, not the documented error shape.
func decodeError(resp *http.Response) error {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("decisions returned %d, and its body could not be read: %w", resp.StatusCode, err)
	}

	apiErr := APIError{Status: resp.StatusCode}
	if err := json.Unmarshal(body, &apiErr); err != nil || apiErr.Message == "" {
		return fmt.Errorf("decisions returned %d: %s", resp.StatusCode, body)
	}
	return &apiErr
}
