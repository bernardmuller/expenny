package application

import (
	"database/sql"
	"fmt"
	"net/url"
	"strings"

	_ "github.com/lib/pq"

	"expenny.co.za/internal/services"
	"expenny.co.za/internal/statements"
	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/systemone"
)

type Application struct {
	Ingestion       *services.IngestionService
	Classifications *services.ClassificationsService
	Review          *services.ReviewService
	Corrections     *services.CorrectionsService
	Budget          *services.BudgetService
	Categories      *services.CategoryService
	CategoryBudgets *services.CategoryBudgetService

	db *sql.DB
}

func CreateApplication(cfg Config) (*Application, error) {
	db, err := sql.Open("postgres", poolerSafeURL(cfg.DbUrl))
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	st := store.New(db)
	parser := statements.NewParser()

	provider := systemone.New(systemone.Config{
		BaseURL: cfg.ClassifierBaseURL,
		APIKey:  cfg.ClassifierApiKey,
		Model:   cfg.ClassifierModel,
	})

	classifications := services.NewClassificationsService(st, provider)

	return &Application{
		Ingestion:       services.NewIngestionService(parser, st, classifications),
		Classifications: classifications,
		Review:          services.NewReviewService(st),
		Corrections:     services.NewCorrectionsService(st),
		Budget:          services.NewBudgetService(st),
		Categories:      services.NewCategoryService(st),
		CategoryBudgets: services.NewCategoryBudgetService(st),
		db:              db,
	}, nil
}

func (a *Application) Queries() *postgres.Queries {
	return postgres.New(a.db)
}

// poolerSafeURL turns on lib/pq's single round-trip mode. By default lib/pq
// sends Parse+Describe+Sync and then Bind+Execute+Sync as two exchanges, and
// the Sync between them ends the implicit transaction. A PgBouncer transaction
// pooler (Supabase's port 6543) may then route the Bind to a different backend
// connection whose unnamed prepared statement belongs to another query, which
// surfaces as "bind message supplies N parameters, but prepared statement
// requires M". With binary_parameters=yes the whole sequence is one packet, so
// the pooler cannot split it. Only []byte parameters go over as binary; every
// other type keeps its text encoding.
func poolerSafeURL(raw string) string {
	if raw == "" || strings.Contains(raw, "binary_parameters=") {
		return raw
	}

	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" {
		// A key=value DSN (host=... port=...) rather than a URL; appending a
		// query string would corrupt it, so leave it untouched.
		return raw
	}

	query := parsed.Query()
	query.Set("binary_parameters", "yes")
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func (a *Application) Close() error {
	return a.db.Close()
}
