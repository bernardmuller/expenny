package categories

import (
	"context"

	"expenny.co.za/internal/store/postgres"
)

type CategoriesRepository struct {
	queries *postgres.Queries
}

func NewCategoriesRepository(queries *postgres.Queries) *CategoriesRepository {
	return &CategoriesRepository{queries: queries}
}

func (r *CategoriesRepository) List(ctx context.Context) ([]postgres.Category, error) {
	return r.queries.GetAllCategories(ctx)
}

func (r *CategoriesRepository) ListActive(ctx context.Context) ([]postgres.Category, error) {
	all, err := r.queries.GetAllCategories(ctx)
	if err != nil {
		return nil, err
	}

	active := make([]postgres.Category, 0, len(all))
	for _, c := range all {
		if !c.DeletedAt.Valid {
			active = append(active, c)
		}
	}
	return active, nil
}
