package store

import (
	"context"
	"database/sql"

	"expenny.co.za/internal/budget"
	"expenny.co.za/internal/categories"
	"expenny.co.za/internal/classifications"
	"expenny.co.za/internal/corrections"
	statementtransactions "expenny.co.za/internal/statement-transactions"
	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/transactions"
)

type Repositories struct {
	Categories      *categories.CategoriesRepository
	Statements      *statementtransactions.StatementTransactionsRepository
	Classifications *classifications.ClassificationsRepository
	Corrections     *corrections.CorrectionsRepository
	Transactions    *transactions.TransactionsRepository
	Budget          *budget.BudgetRepository
	CategoryBudgets *budget.CategoryBudgetRepository
}

func newRepositories(q *postgres.Queries) *Repositories {
	return &Repositories{
		Categories:      categories.NewCategoriesRepository(q),
		Statements:      statementtransactions.NewStatementTransactionRepository(q),
		Classifications: classifications.NewClassificationsRepository(q),
		Corrections:     corrections.NewCorrectionsRepository(q),
		Transactions:    transactions.NewTransactionsRepository(q),
		Budget:          budget.NewBudgetRepository(q),
		CategoryBudgets: budget.NewCategoryBudgetRepository(q),
	}
}

type Store struct {
	db    *sql.DB
	repos *Repositories
}

func New(db *sql.DB) *Store {
	return &Store{db: db, repos: newRepositories(postgres.New(db))}
}

func (s *Store) Repos() *Repositories { return s.repos }

func (s *Store) Do(ctx context.Context, fn func(*Repositories) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := fn(newRepositories(postgres.New(tx))); err != nil {
		return err
	}

	return tx.Commit()
}
