package budget

import (
	"context"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
)

type CategoryBudgetRepository struct {
	queries *postgres.Queries
}

func NewCategoryBudgetRepository(queries *postgres.Queries) *CategoryBudgetRepository {
	return &CategoryBudgetRepository{queries: queries}
}

func (r *CategoryBudgetRepository) ActiveBudget(ctx context.Context, userID uuid.UUID) (postgres.Budget, error) {
	return r.queries.GetActiveBudgetByUser(ctx, userID)
}

// ListByBudget returns one non-deleted allocation per category, keeping the
// most recently updated row when a budget has duplicates.
func (r *CategoryBudgetRepository) ListByBudget(ctx context.Context, budgetID uuid.UUID) ([]postgres.GetCategoryBudgetsByBudgetRow, error) {
	return r.queries.GetCategoryBudgetsByBudget(ctx, budgetID)
}

func (r *CategoryBudgetRepository) GetForUser(ctx context.Context, id, userID uuid.UUID) (postgres.CategoryBudget, error) {
	return r.queries.GetCategoryBudgetForUser(ctx, postgres.GetCategoryBudgetForUserParams{
		ID:     id,
		UserID: userID,
	})
}

func (r *CategoryBudgetRepository) GetByBudgetAndCategory(ctx context.Context, budgetID, categoryID uuid.UUID) (postgres.CategoryBudget, error) {
	return r.queries.GetCategoryBudgetByBudgetAndCategory(ctx, postgres.GetCategoryBudgetByBudgetAndCategoryParams{
		BudgetID:   budgetID,
		CategoryID: categoryID,
	})
}

func (r *CategoryBudgetRepository) Create(ctx context.Context, budgetID, categoryID uuid.UUID, allocated string) (postgres.CategoryBudget, error) {
	return r.queries.CreateCategoryBudget(ctx, postgres.CreateCategoryBudgetParams{
		ID:              uuid.New(),
		BudgetID:        budgetID,
		CategoryID:      categoryID,
		AllocatedAmount: allocated,
	})
}

func (r *CategoryBudgetRepository) Update(ctx context.Context, id uuid.UUID, allocated string) (postgres.CategoryBudget, error) {
	return r.queries.UpdateCategoryBudget(ctx, postgres.UpdateCategoryBudgetParams{
		ID:              id,
		AllocatedAmount: allocated,
	})
}

func (r *CategoryBudgetRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	return r.queries.SoftDeleteCategoryBudget(ctx, id)
}

// SpendByUser sums money_out and fees minus money_in per category over the
// window, so a repayment against a spending category reduces its net spend.
func (r *CategoryBudgetRepository) SpendByUser(ctx context.Context, userID uuid.UUID, start, end time.Time) (map[uuid.UUID]string, error) {
	rows, err := r.queries.GetCategorySpendByUser(ctx, postgres.GetCategorySpendByUserParams{
		UserID:    userID,
		StartDate: start,
		EndDate:   end,
	})
	if err != nil {
		return nil, err
	}

	spends := make(map[uuid.UUID]string, len(rows))
	for _, row := range rows {
		spends[row.CategoryID] = row.Spent
	}
	return spends, nil
}
