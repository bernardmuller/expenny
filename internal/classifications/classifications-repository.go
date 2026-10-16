package classifications

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/store/utils"
)

// SourceHuman marks a classification a person confirmed. The classifier never
// overwrites one.
const SourceHuman = "human"

type UpsertClassificationDTO struct {
	StatementTransactionID uuid.UUID
	CategoryID             *uuid.UUID
	IsExpense              *bool
	ExpenseProb            *float64
	Confidence             *float64
	Source                 string
	GroupKey               string
	ClassifierVersion      *string
	ClassifiedAt           *time.Time
}

type ClassificationsRepository struct {
	queries *postgres.Queries
}

func NewClassificationsRepository(queries *postgres.Queries) *ClassificationsRepository {
	return &ClassificationsRepository{queries: queries}
}

// Upsert inserts the classifier's verdict. The query refuses to overwrite a
// classification that already carries a human decision, so a row with no
// result comes back silently instead of as an error.
func (r *ClassificationsRepository) Upsert(ctx context.Context, dto UpsertClassificationDTO) (postgres.StatementTransactionClassification, error) {
	row, err := r.queries.UpsertClassification(ctx, postgres.UpsertClassificationParams{
		ID:                     uuid.New(),
		StatementTransactionID: dto.StatementTransactionID,
		CategoryID:             utils.NullUUID(dto.CategoryID),
		IsExpense:              utils.NullBool(dto.IsExpense),
		ExpenseProb:            utils.NullRatio(dto.ExpenseProb),
		Confidence:             utils.NullRatio(dto.Confidence),
		Source:                 dto.Source,
		GroupKey:               utils.NullString(utils.OptionalString(dto.GroupKey)),
		ClassifierVersion:      utils.NullString(dto.ClassifierVersion),
		ClassifiedAt:           utils.NullTime(dto.ClassifiedAt),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return postgres.StatementTransactionClassification{}, nil
	}
	return row, err
}

// UpsertHuman records a human decision, replacing whatever the classifier had
// decided for the transaction.
func (r *ClassificationsRepository) UpsertHuman(ctx context.Context, dto UpsertClassificationDTO) (postgres.StatementTransactionClassification, error) {
	return r.queries.UpsertHumanClassification(ctx, postgres.UpsertHumanClassificationParams{
		ID:                     uuid.New(),
		StatementTransactionID: dto.StatementTransactionID,
		CategoryID:             utils.NullUUID(dto.CategoryID),
		IsExpense:              utils.NullBool(dto.IsExpense),
		ExpenseProb:            utils.NullRatio(dto.ExpenseProb),
		Confidence:             utils.NullRatio(dto.Confidence),
		Source:                 dto.Source,
		GroupKey:               utils.NullString(utils.OptionalString(dto.GroupKey)),
		ClassifierVersion:      utils.NullString(dto.ClassifierVersion),
		ClassifiedAt:           utils.NullTime(dto.ClassifiedAt),
	})
}

func (r *ClassificationsRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]postgres.StatementTransactionClassification, error) {
	return r.queries.GetAllClassificationsByUserID(ctx, userID)
}

// MarkSeen records that a human looked at a row's classification and returns
// when it happened. Rows with no classification, or rows owned by somebody
// else, come back as sql.ErrNoRows.
func (r *ClassificationsRepository) MarkSeen(ctx context.Context, userID, transactionID uuid.UUID) (time.Time, error) {
	seenAt, err := r.queries.MarkStatementTransactionSeen(ctx, postgres.MarkStatementTransactionSeenParams{
		StatementTransactionID: transactionID,
		UserID:                 userID,
	})
	if err != nil {
		return time.Time{}, err
	}
	return seenAt.Time, nil
}
