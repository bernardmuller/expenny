package services

import (
	"context"

	"github.com/google/uuid"

	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
)

// NeedsReviewThreshold is the confidence below which a classification is
// handed to a human. Rows that were never classified also need a human.
const NeedsReviewThreshold = 0.8

// ReviewService serves the dashboard view: every statement row joined with its
// classification and category, plus the category options a review needs.
type ReviewService struct {
	store *store.Store
}

func NewReviewService(st *store.Store) *ReviewService {
	return &ReviewService{store: st}
}

// ListTransactions returns every statement transaction for the user, joined
// with its classification and category. Rows that were never classified come
// back with the classification fields empty.
func (s *ReviewService) ListTransactions(ctx context.Context, userID uuid.UUID) ([]postgres.GetClassifiedStatementTransactionsByUserIdRow, error) {
	return s.store.Repos().Statements.ListClassifiedByUser(ctx, userID)
}

// ListCategories returns the categories a human can correct a row to.
func (s *ReviewService) ListCategories(ctx context.Context) ([]postgres.Category, error) {
	return s.store.Repos().Categories.ListActive(ctx)
}
