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
		ClassifierVersion:      utils.NullString(dto.ClassifierVersion),
		ClassifiedAt:           utils.NullTime(dto.ClassifiedAt),
	})
}

func (r *ClassificationsRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]postgres.StatementTransactionClassification, error) {
	return r.queries.GetAllClassificationsByUserID(ctx, userID)
}
