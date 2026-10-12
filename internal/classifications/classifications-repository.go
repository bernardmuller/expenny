package classifications

import (
	"context"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/store/utils"
)

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

func (r *ClassificationsRepository) Upsert(ctx context.Context, dto UpsertClassificationDTO) (postgres.StatementTransactionClassification, error) {
	return r.queries.UpsertClassification(ctx, postgres.UpsertClassificationParams{
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
