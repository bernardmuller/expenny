package systemone

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"expenny.co.za/internal/httpclient"
)

const (
	TypeChoice = "choice"
	TypeScore  = "score"
	TypeNoul   = "noul"
)

const (
	// DefaultBaseURL is the decision API gateway origin.
	DefaultBaseURL = "https://api.typesafe.ai"

	// DefaultPath is the decisions endpoint.
	DefaultPath = "/v1/systemone"

	// DefaultModel is the model used when Config.Model is empty.
	DefaultModel = "jev-1.13.0"
)

type Config struct {
	BaseURL string
	Path    string
	APIKey  string
	Model   string
}

type Client struct {
	path   string
	model  string
	client *httpclient.Client
}

func New(cfg Config) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = DefaultBaseURL
	}
	if cfg.Path == "" {
		cfg.Path = DefaultPath
	}
	if cfg.Model == "" {
		cfg.Model = DefaultModel
	}

	return &Client{
		path:  cfg.Path,
		model: cfg.Model,
		client: &httpclient.Client{
			BaseURL:    cfg.BaseURL,
			HTTPClient: &http.Client{Timeout: 30 * time.Second},
			Headers:    http.Header{"Authorization": {"Bearer " + cfg.APIKey}},
		},
	}
}

type Request struct {
	State     any                 `json:"state"`
	Questions map[string]Question `json:"questions"`
}

type Question struct {
	Type         string   `json:"type"`
	Instructions string   `json:"instructions"`
	Criteria     Criteria `json:"criteria,omitempty"`
}

type Options map[string]string

type Criteria interface{ criteria() }

func (Options) criteria() {}

type Levels []string

func (Levels) criteria() {}

func Choice(instructions string, options map[string]string) Question {
	return Question{Type: TypeChoice, Instructions: instructions, Criteria: Options(options)}
}

func Score(instructions string, levels ...string) Question {
	return Question{Type: TypeScore, Instructions: instructions, Criteria: Levels(levels)}
}

func Noul(instructions string) Question {
	return Question{Type: TypeNoul, Instructions: instructions}
}

func NoulWithCriteria(instructions, whenTrue, whenFalse string) Question {
	return Question{
		Type:         TypeNoul,
		Instructions: instructions,
		Criteria:     Options{"true": whenTrue, "false": whenFalse},
	}
}

type Response struct {
	ID       string            `json:"id"`
	Model    string            `json:"model"`
	Provider string            `json:"provider"`
	Answers  map[string]Answer `json:"answers"`
	Usage    Usage             `json:"usage"`
	TaskID   string            `json:"task_id"`
	Consumed string            `json:"consumed"`
}

type Usage struct {
	InputTokens  int     `json:"input_tokens"`
	OutputTokens int     `json:"output_tokens"`
	Cost         float64 `json:"cost"`
}

type Answer struct {
	Type          string             `json:"type"`
	Noul          *float64           `json:"noul,omitempty"`
	Choice        string             `json:"choice,omitempty"`
	Score         *float64           `json:"score,omitempty"`
	Legend        map[string]string  `json:"legend,omitempty"`
	Confidence    *float64           `json:"confidence,omitempty"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
}

type APIError struct {
	Status  int    `json:"-"`
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

func (e *APIError) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("systemone: %d %s: %s", e.Status, e.Message, e.Detail)
	}
	return fmt.Sprintf("systemone: %d %s", e.Status, e.Message)
}

func (c *Client) Decide(ctx context.Context, req Request) (*Response, error) {
	payload := struct {
		Model     string              `json:"model"`
		State     any                 `json:"state"`
		Questions map[string]Question `json:"questions"`
	}{
		Model:     c.model,
		State:     req.State,
		Questions: req.Questions,
	}

	var out Response
	if err := c.client.Post(ctx, c.path, payload, &out); err != nil {
		return nil, toAPIError(err)
	}
	return &out, nil
}

func toAPIError(err error) error {
	var se *httpclient.StatusError
	if !errors.As(err, &se) {
		return err
	}

	apiErr := APIError{Status: se.StatusCode}
	if json.Unmarshal(se.Body, &apiErr) == nil && apiErr.Message != "" {
		return &apiErr
	}
	return fmt.Errorf("systemone returned %d: %s", se.StatusCode, se.Body)
}
