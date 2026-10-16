package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	"expenny.co.za/internal/application"
	"expenny.co.za/internal/auth"
)

const (
	addr = ":5420"

	// API Gateway HTTP API delivers RawPath including the stage, e.g.
	// "/default/expenny-api/v2/me" for this API. The mux expects "/v2/me", so
	// this stage+route prefix is stripped before routing. Set API_BASE_PATH to
	// override (use an empty value when a custom domain removes the stage).
	defaultBasePath = "/default/expenny-api"
)

func main() {
	cfg, err := application.CreateConfig()
	if err != nil {
		log.Fatalf("startup: %v", err)
	}

	app, err := application.CreateApplication(cfg)
	if err != nil {
		log.Fatalf("startup: %v", err)
	}

	handler := newHandler(app, cfg.AuthSecret)

	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != "" {
		basePath, ok := os.LookupEnv("API_BASE_PATH")
		if !ok {
			basePath = defaultBasePath
		}

		root := handler
		if basePath != "" {
			root = http.StripPrefix(basePath, handler)
		}

		adapter := httpadapter.NewV2(root)
		log.Printf("starting aws lambda handler (api gateway v2, base path %q)", basePath)
		lambda.Start(adapter.ProxyWithContext)
		return
	}

	log.Printf("http api listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func newHandler(app *application.Application, secret string) http.Handler {
	verifier := auth.NewSessionVerifier(secret, app.Queries())
	api := &api{app: app}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v2/hello", handleHello)
	mux.Handle("GET /v2/me", verifier.RequireUser(http.HandlerFunc(handleMe)))
	mux.Handle("POST /v2/statements", verifier.RequireUser(http.HandlerFunc(api.ingestStatement)))
	mux.Handle("POST /v2/statements/classify", verifier.RequireUser(http.HandlerFunc(api.classifyTransactions)))
	mux.Handle("GET /v2/statements/classification/status", verifier.RequireUser(http.HandlerFunc(api.classificationStatus)))
	mux.Handle("GET /v2/statements/transactions", verifier.RequireUser(http.HandlerFunc(api.listTransactions)))
	mux.Handle("POST /v2/statements/transactions/{id}/correction", verifier.RequireUser(http.HandlerFunc(api.correctTransaction)))
	mux.Handle("PATCH /v2/statements/transactions/{id}/category", verifier.RequireUser(http.HandlerFunc(api.updateTransactionCategory)))
	mux.Handle("GET /v2/categories", verifier.RequireUser(http.HandlerFunc(api.listCategories)))
	mux.Handle("POST /v2/categories", verifier.RequireUser(http.HandlerFunc(api.createCategory)))
	mux.Handle("PATCH /v2/categories/{id}", verifier.RequireUser(http.HandlerFunc(api.updateCategory)))
	mux.Handle("DELETE /v2/categories/{id}", verifier.RequireUser(http.HandlerFunc(api.deleteCategory)))
	mux.Handle("GET /v2/category-budgets", verifier.RequireUser(http.HandlerFunc(api.getCategoryBudgets)))
	mux.Handle("GET /v2/category-budgets/{id}/transactions", verifier.RequireUser(http.HandlerFunc(api.listCategoryTransactions)))
	mux.Handle("POST /v2/category-budgets", verifier.RequireUser(http.HandlerFunc(api.setCategoryBudget)))
	mux.Handle("PATCH /v2/category-budgets/{id}", verifier.RequireUser(http.HandlerFunc(api.updateCategoryBudget)))
	mux.Handle("DELETE /v2/category-budgets/{id}", verifier.RequireUser(http.HandlerFunc(api.deleteCategoryBudget)))
	mux.Handle("GET /v2/category-groups", verifier.RequireUser(http.HandlerFunc(api.listCategoryGroups)))
	mux.Handle("POST /v2/category-groups", verifier.RequireUser(http.HandlerFunc(api.createCategoryGroup)))
	mux.Handle("PATCH /v2/category-groups/{id}", verifier.RequireUser(http.HandlerFunc(api.updateCategoryGroup)))
	mux.Handle("DELETE /v2/category-groups/{id}", verifier.RequireUser(http.HandlerFunc(api.deleteCategoryGroup)))
	mux.Handle("GET /v2/corrections", verifier.RequireUser(http.HandlerFunc(api.listCorrections)))
	mux.Handle("POST /v2/corrections", verifier.RequireUser(http.HandlerFunc(api.createCorrection)))
	mux.Handle("PATCH /v2/corrections/{id}", verifier.RequireUser(http.HandlerFunc(api.updateCorrection)))
	mux.Handle("DELETE /v2/corrections/{id}", verifier.RequireUser(http.HandlerFunc(api.deleteCorrection)))
	mux.Handle("GET /v2/budget", verifier.RequireUser(http.HandlerFunc(api.getBudget)))
	mux.Handle("PUT /v2/budget/preferences", verifier.RequireUser(http.HandlerFunc(api.updateBudgetPreferences)))

	return logRequests(withCORS(mux))
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		}

		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}
