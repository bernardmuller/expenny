package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	statementtransactions "expenny.co.za/internal/statement-transactions"
	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
)

// NeedsReviewThreshold is the confidence below which a classification is
// handed to a human. Rows that were never classified also need a human.
const NeedsReviewThreshold = 0.8

// Statement page sizes served by the API. The default keeps the dashboard's
// first payload small; the max stops a caller from asking for everything.
const (
	DefaultTransactionPageSize = 20
	MaxTransactionPageSize     = 100
)

// TransactionPage is one slice of the user's statement rows plus the totals
// the dashboard needs for counters that span every page.
type TransactionPage struct {
	Rows        []postgres.GetClassifiedStatementTransactionsByUserIdPageRow
	Total       int
	ReviewCount int
}

// ReviewService serves the dashboard view: a page of statement rows joined
// with their classification and category, plus the category options a review
// needs.
type ReviewService struct {
	store *store.Store
}

func NewReviewService(st *store.Store) *ReviewService {
	return &ReviewService{store: st}
}

// ListTransactions returns a page of statement transactions for the user,
// newest first, joined with their classification and category. Rows that were
// never classified come back with the classification fields empty. Total and
// ReviewCount cover the whole statement, not just the page.
func (s *ReviewService) ListTransactions(ctx context.Context, userID uuid.UUID, limit, offset int) (TransactionPage, error) {
	limit = clampPageSize(limit)
	if offset < 0 {
		offset = 0
	}

	rows, err := s.store.Repos().Statements.ListClassifiedByUser(ctx, userID, statementtransactions.ClassifiedListFilter{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return TransactionPage{}, err
	}

	total, err := s.store.Repos().Statements.CountByUser(ctx, userID)
	if err != nil {
		return TransactionPage{}, err
	}

	reviewCount, err := s.store.Repos().Statements.CountNeedingReview(ctx, userID, NeedsReviewThreshold)
	if err != nil {
		return TransactionPage{}, err
	}

	return TransactionPage{
		Rows:        rows,
		Total:       int(total),
		ReviewCount: int(reviewCount),
	}, nil
}

// CategoryTransactions returns the user's classified rows for one category
// inside a window, newest first, capped at limit.
func (s *ReviewService) CategoryTransactions(ctx context.Context, userID, categoryID uuid.UUID, start, end *time.Time, limit int) ([]postgres.GetClassifiedStatementTransactionsByUserIdPageRow, error) {
	return s.store.Repos().Statements.ListClassifiedByUser(ctx, userID, statementtransactions.ClassifiedListFilter{
		Limit:       limit,
		CategoryID:  &categoryID,
		WindowStart: start,
		WindowEnd:   end,
	})
}

// UnclassifiedTransactions returns the user's rows from the given id set that
// still need a classification. Ids that are unknown, owned by somebody else,
// or already classified are omitted, which lets the classify endpoint treat
// them as skipped work.
func (s *ReviewService) UnclassifiedTransactions(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) ([]postgres.StatementTransaction, error) {
	return s.store.Repos().Statements.ListUnclassifiedByIDs(ctx, userID, ids)
}

// PendingTransactions returns up to limit of the user's rows that have no
// classification yet, oldest first. A client can use it to keep classifying
// after a reload without remembering the row ids from the original upload.
func (s *ReviewService) PendingTransactions(ctx context.Context, userID uuid.UUID, limit int) ([]postgres.StatementTransaction, error) {
	if limit <= 0 {
		limit = DefaultTransactionPageSize
	}
	return s.store.Repos().Statements.ListUnclassifiedByUser(ctx, userID, limit)
}

// PendingCount returns how many statement rows the user still has to
// classify.
func (s *ReviewService) PendingCount(ctx context.Context, userID uuid.UUID) (int, error) {
	count, err := s.store.Repos().Statements.CountUnclassifiedByUser(ctx, userID)
	return int(count), err
}

// ClassificationStatus summarizes how far the user's statement has been
// classified. The dashboard uses it to detect and resume an interrupted
// import.
func (s *ReviewService) ClassificationStatus(ctx context.Context, userID uuid.UUID) (ClassificationStatus, error) {
	total, err := s.store.Repos().Statements.CountByUser(ctx, userID)
	if err != nil {
		return ClassificationStatus{}, err
	}

	pending, err := s.store.Repos().Statements.CountUnclassifiedByUser(ctx, userID)
	if err != nil {
		return ClassificationStatus{}, err
	}

	reviewCount, err := s.store.Repos().Statements.CountNeedingReview(ctx, userID, NeedsReviewThreshold)
	if err != nil {
		return ClassificationStatus{}, err
	}

	return ClassificationStatus{
		Total:       int(total),
		Classified:  int(total - pending),
		Pending:     int(pending),
		NeedsReview: int(reviewCount),
	}, nil
}

// ClassificationStatus is a point-in-time snapshot of the classification
// work left for a user.
type ClassificationStatus struct {
	Total       int
	Classified  int
	Pending     int
	NeedsReview int
}

func clampPageSize(limit int) int {
	if limit <= 0 {
		return DefaultTransactionPageSize
	}
	if limit > MaxTransactionPageSize {
		return MaxTransactionPageSize
	}
	return limit
}
