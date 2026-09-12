package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	_ "github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type contextKey string

const (
	tokenKey contextKey = "auth-token"
	userKey  contextKey = "auth-user"
)

type AuthUser struct {
	jwt.RegisteredClaims
	ID    string `json:"userId"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type OAuthClientClaims struct {
	jwt.RegisteredClaims
	ClientID string `json:"clientId"`
	Scope    string `json:"scope"`
	TokenUse string `json:"token_use"`
}

func extractAuth(ctx context.Context, r *http.Request) context.Context {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ctx
	}
	token := strings.TrimPrefix(auth, "Bearer ")
	if token == "" {
		return ctx
	}
	return context.WithValue(ctx, tokenKey, token)
}

func parseToken(token string, claims jwt.Claims) error {
	secret := os.Getenv("AUTH_SECRET")
	if secret == "" {
		return fmt.Errorf("server misconfiguration: AUTH_SECRET not set")
	}

	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return err
	}
	if !parsed.Valid {
		return fmt.Errorf("invalid token")
	}
	return nil
}

func authMode() string {
	mode := os.Getenv("AUTH_MODE")
	if mode == "" {
		return "legacy"
	}
	return mode
}

func authMiddleware(next server.ToolHandlerFunc) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		token, _ := ctx.Value(tokenKey).(string)
		if token == "" {
			return nil, fmt.Errorf("authentication required: no token provided")
		}

		if authMode() == "better-auth" {
			claims := &OAuthClientClaims{}
			if err := parseToken(token, claims); err != nil {
				return nil, fmt.Errorf("invalid token: %w", err)
			}
			if claims.TokenUse != "client_credentials" {
				return nil, fmt.Errorf("invalid token: expected client_credentials token")
			}
			if claims.ClientID == "" {
				return nil, fmt.Errorf("invalid token payload: missing clientId")
			}
			ctx = context.WithValue(ctx, userKey, claims)
			return next(ctx, req)
		}

		claims := &AuthUser{}
		if err := parseToken(token, claims); err != nil {
			return nil, fmt.Errorf("invalid token: %w", err)
		}
		if claims.ID == "" || claims.Email == "" || claims.Name == "" {
			return nil, fmt.Errorf("invalid token payload: missing required fields")
		}

		ctx = context.WithValue(ctx, userKey, claims)
		return next(ctx, req)
	}
}

func main() {
	s := server.NewMCPServer(
		"Expenny MCP",
		"1.0.0",
		server.WithToolCapabilities(false),
	)

	s.Use(authMiddleware)

	tool := mcp.NewTool("whoami",
		mcp.WithDescription("Returns the authenticated principal's identity"),
	)
	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		if authMode() == "better-auth" {
			claims, ok := ctx.Value(userKey).(*OAuthClientClaims)
			if !ok {
				return nil, fmt.Errorf("not authenticated")
			}
			msg := fmt.Sprintf(
				"Hello, %s! You are authenticated with Expenny MCP via OAuth client credentials. (scope: %s)",
				claims.ClientID, claims.Scope,
			)
			return mcp.NewToolResultText(msg), nil
		}

		user, ok := ctx.Value(userKey).(*AuthUser)
		if !ok {
			return nil, fmt.Errorf("not authenticated")
		}
		msg := fmt.Sprintf("Hello, %s! You are authenticated with Expenny MCP. (email: %s)", user.Name, user.Email)
		return mcp.NewToolResultText(msg), nil
	})

	httpServer := server.NewStreamableHTTPServer(s,
		server.WithHTTPContextFunc(extractAuth),
		server.WithEndpointPath("/mcp"),
		server.WithDisableLocalhostProtection(true),
	)

	log.Println("Expenny MCP server listening on :8080/mcp")
	if err := httpServer.Start(":8080"); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
