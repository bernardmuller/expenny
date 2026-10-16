package budget

import (
	"context"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/store/utils"
)

type UpsertBudgetPreferenceDTO struct {
	Account   *string
	StartDate time.Time
	EndDate   time.Time
}

type BudgetRepository struct {
	queries *postgres.Queries
}

func NewBudgetRepository(queries *postgres.Queries) *BudgetRepository {
	return &BudgetRepository{queries: queries}
}

func (r *BudgetRepository) GetByUser(ctx context.Context, userID uuid.UUID) (postgres.BudgetPreference, error) {
	return r.queries.GetBudgetPreferenceByUser(ctx, userID)
}

func (r *BudgetRepository) Upsert(ctx context.Context, userID uuid.UUID, dto UpsertBudgetPreferenceDTO) (postgres.BudgetPreference, error) {
	return r.queries.UpsertBudgetPreference(ctx, postgres.UpsertBudgetPreferenceParams{
		ID:        uuid.New(),
		UserID:    userID,
		Account:   utils.NullString(dto.Account),
		StartDate: dto.StartDate,
		EndDate:   dto.EndDate,
	})
}
