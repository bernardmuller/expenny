package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/joho/godotenv"
)

// apiURL is the Expenny API origin, resolved once at startup. It must be
// absolute: it is handed to MCP clients in the WWW-Authenticate challenge as
// the resource_metadata URL, and a relative value silently breaks OAuth
// discovery.
var apiURL string

func resolveAPIURL() string {
	if u := os.Getenv("EXPENNY_API_URL"); u != "" {
		return strings.TrimSuffix(u, "/")
	}
	return "http://localhost:8080"
}

// ─── Types ────────────────────────────────────────────────────────────────────

type contextKey string

const userKey contextKey = "auth-user"

// Principal holds the authenticated user info from the API's /auth/mcp/userinfo.
type Principal struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

// ─── Token introspection cache ────────────────────────────────────────────────

type cacheEntry struct {
	principal *Principal
	expiresAt time.Time
}

type tokenCache struct {
	mu    sync.Mutex
	items map[string]cacheEntry
}

var cache = &tokenCache{items: make(map[string]cacheEntry)}

// Introspection sits in the request path — never let a stalled API hang a tool call.
var introspectClient = &http.Client{Timeout: 10 * time.Second}

func (c *tokenCache) get(token string) (*Principal, bool) {
	key := hashToken(token)
	c.mu.Lock()
	defer c.mu.Unlock()
	if e, ok := c.items[key]; ok && time.Now().Before(e.expiresAt) {
		return e.principal, true
	}
	delete(c.items, key)
	return nil, false
}

func (c *tokenCache) set(token string, p *Principal, ttl time.Duration) {
	key := hashToken(token)
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = cacheEntry{principal: p, expiresAt: time.Now().Add(ttl)}
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", h)
}

// ─── Userinfo introspection ───────────────────────────────────────────────────

func introspect(token string) (*Principal, error) {
	if p, ok := cache.get(token); ok {
		return p, nil
	}

	// Matches userinfo_endpoint in the API's authorization-server metadata.
	uiReq, err := http.NewRequest(http.MethodGet, apiURL+"/auth/mcp/userinfo", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build userinfo request: %w", err)
	}
	uiReq.Header.Set("Authorization", "Bearer "+token)

	resp, err := introspectClient.Do(uiReq)
	if err != nil {
		return nil, fmt.Errorf("userinfo request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("invalid or expired token")
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("userinfo returned %d: %s", resp.StatusCode, body)
	}

	var p Principal
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		return nil, fmt.Errorf("failed to decode userinfo: %w", err)
	}
	if p.Sub == "" {
		return nil, fmt.Errorf("userinfo missing sub field")
	}

	cache.set(token, &p, 60*time.Second)
	return &p, nil
}

// ─── HTTP auth middleware ─────────────────────────────────────────────────────

func authHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		token := strings.TrimPrefix(auth, "Bearer ")

		if auth == "" || token == auth {
			// No bearer token — emit 401 with WWW-Authenticate per RFC 9728 §3
			resourceMetaURL := apiURL + "/.well-known/oauth-protected-resource"
			w.Header().Set(
				"WWW-Authenticate",
				fmt.Sprintf(`Bearer resource_metadata="%s"`, resourceMetaURL),
			)
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		principal, err := introspect(token)
		if err != nil {
			resourceMetaURL := apiURL + "/.well-known/oauth-protected-resource"
			w.Header().Set(
				"WWW-Authenticate",
				fmt.Sprintf(`Bearer error="invalid_token", resource_metadata="%s"`, resourceMetaURL),
			)
			http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userKey, principal)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ─── Server ───────────────────────────────────────────────────────────────────

func main() {
	// Best-effort: the repo-root .env is how EXPENNY_API_URL is supplied locally.
	_ = godotenv.Load()
	apiURL = resolveAPIURL()

	s := server.NewMCPServer(
		"Expenny MCP",
		"1.0.0",
		server.WithToolCapabilities(false),
	)

	whoamiTool := mcp.NewTool("whoami",
		mcp.WithDescription("Returns the authenticated user's name and email"),
	)
	s.AddTool(whoamiTool, func(ctx context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		p, ok := ctx.Value(userKey).(*Principal)
		if !ok || p == nil {
			return nil, fmt.Errorf("not authenticated")
		}
		msg := fmt.Sprintf("Hello, %s! Your email is %s.", p.Name, p.Email)
		return mcp.NewToolResultText(msg), nil
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "5420"
	}

	mcpHTTP := server.NewStreamableHTTPServer(s,
		server.WithEndpointPath("/mcp"),
		server.WithDisableLocalhostProtection(true),
	)

	// Wrap the MCP HTTP handler with our auth middleware
	wrappedHandler := authHandler(mcpHTTP)

	addr := ":" + port
	log.Printf("Expenny MCP server listening on %s/mcp (api: %s)", addr, apiURL)
	if err := http.ListenAndServe(addr, wrappedHandler); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
