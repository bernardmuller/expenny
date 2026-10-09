package jev

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
	DefaultBaseURL = "https://api.typesafe.ai"
	DefaultModel   = "jev-1.13.0"
	decisionsPath  = "/v1/systemone"
)

const (
	TypeChoice = "choice"
	TypeScore  = "score"
	TypeNoul   = "noul"
)

type Client struct {
	APIKey  string
	BaseURL string
	client  *httpclient.Client
}

func New(apiKey string) *Client {
	return &Client{
		client: &httpclient.Client{
			BaseURL:    DefaultBaseURL,
			HTTPClient: &http.Client{Timeout: 30 * time.Second},
			Headers:    http.Header{"Authorization": {"Bearer " + apiKey}},
		},
	}
}

type Request struct {
	Model     string              `json:"model"`
	State     any                 `json:"state"`
	Questions map[string]Question `json:"questions"`
}

type Question struct {
	Type         string `json:"type"`
	Instructions any    `json:"instructions"`
	Criteria     any    `json:"criteria,omitempty"`
}

func Choice(instructions string, options map[string]string) Question {
	return Question{Type: TypeChoice, Instructions: instructions, Criteria: options}
}

func Score(instructions string, levels ...string) Question {
	return Question{Type: TypeScore, Instructions: instructions, Criteria: levels}
}

func Noul(instructions string) Question {
	return Question{Type: TypeNoul, Instructions: instructions}
}

func NoulWithCriteria(instructions, whenTrue, whenFalse string) Question {
	return Question{
		Type:         TypeNoul,
		Instructions: instructions,
		Criteria:     map[string]string{"true": whenTrue, "false": whenFalse},
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
		return fmt.Sprintf("jev: %d %s: %s", e.Status, e.Message, e.Detail)
	}
	return fmt.Sprintf("jev: %d %s", e.Status, e.Message)
}

func (c *Client) Decide(ctx context.Context, req Request) (*Response, error) {
	if req.Model == "" {
		req.Model = DefaultModel
	}

	var out Response
	if err := c.client.Post(ctx, decisionsPath, req, &out); err != nil {
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
	return fmt.Errorf("decisions returned %d: %s", se.StatusCode, se.Body)
}
