package application

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"

	"expenny.co.za/internal/services"
	"expenny.co.za/internal/statements"
	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
)

type Application struct {
	Ingestion *services.IngestionService

	db *sql.DB
}

func CreateApplication(cfg Config) (*Application, error) {
	db, err := sql.Open("postgres", cfg.DbUrl)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	st := store.New(db)
	parser := statements.NewParser()

	return &Application{
		Ingestion: services.NewIngestionService(parser, st),
		db:        db,
	}, nil
}

func (a *Application) Queries() *postgres.Queries {
	return postgres.New(a.db)
}

func (a *Application) Close() error {
	return a.db.Close()
}
