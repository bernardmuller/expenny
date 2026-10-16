package categories

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"expenny.co.za/internal/store/postgres"
)

type CategoriesRepository struct {
	queries *postgres.Queries
}

func NewCategoriesRepository(queries *postgres.Queries) *CategoriesRepository {
	return &CategoriesRepository{queries: queries}
}

func (r *CategoriesRepository) GetByID(ctx context.Context, id uuid.UUID) (postgres.Category, error) {
	return r.queries.GetCategoryById(ctx, id)
}

func (r *CategoriesRepository) GetByKey(ctx context.Context, key string) (postgres.Category, error) {
	return r.queries.GetCategoryByKey(ctx, key)
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

func (r *CategoriesRepository) Create(ctx context.Context, key, label, icon string) (postgres.Category, error) {
	return r.queries.CreateCategory(ctx, postgres.CreateCategoryParams{
		ID:    uuid.New(),
		Key:   key,
		Label: label,
		Icon:  icon,
	})
}

func (r *CategoriesRepository) Update(ctx context.Context, id uuid.UUID, key, label, icon string) (postgres.Category, error) {
	return r.queries.UpdateCategory(ctx, postgres.UpdateCategoryParams{
		ID:    id,
		Key:   key,
		Label: label,
		Icon:  icon,
	})
}

// Restore revives a soft-deleted category with fresh values, so a key can be
// reused after a delete without losing the classifications that reference it.
func (r *CategoriesRepository) Restore(ctx context.Context, id uuid.UUID, key, label, icon string) (postgres.Category, error) {
	return r.queries.RestoreCategory(ctx, postgres.RestoreCategoryParams{
		ID:    id,
		Key:   key,
		Label: label,
		Icon:  icon,
	})
}

func (r *CategoriesRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	return r.queries.SoftDeleteCategory(ctx, id)
}

// Groups returns the category group dictionary, ordered by label.
func (r *CategoriesRepository) Groups(ctx context.Context) ([]postgres.CategoryGroup, error) {
	return r.queries.GetCategoryGroups(ctx)
}

func (r *CategoriesRepository) GetGroupByID(ctx context.Context, id uuid.UUID) (postgres.CategoryGroup, error) {
	return r.queries.GetCategoryGroupById(ctx, id)
}

func (r *CategoriesRepository) CreateGroup(ctx context.Context, key, label string) (postgres.CategoryGroup, error) {
	return r.queries.CreateCategoryGroup(ctx, postgres.CreateCategoryGroupParams{
		ID:    uuid.New(),
		Key:   key,
		Label: label,
	})
}

func (r *CategoriesRepository) UpdateGroup(ctx context.Context, id uuid.UUID, key, label string) (postgres.CategoryGroup, error) {
	return r.queries.UpdateCategoryGroup(ctx, postgres.UpdateCategoryGroupParams{
		ID:    id,
		Key:   key,
		Label: label,
	})
}

func (r *CategoriesRepository) DeleteGroup(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteCategoryGroup(ctx, id)
}

// Memberships returns category id -> the group keys it may be tagged with.
func (r *CategoriesRepository) Memberships(ctx context.Context) (map[uuid.UUID][]string, error) {
	rows, err := r.queries.GetCategoryGroupMembers(ctx)
	if err != nil {
		return nil, err
	}

	memberships := make(map[uuid.UUID][]string, len(rows))
	for _, row := range rows {
		memberships[row.CategoryID] = append(memberships[row.CategoryID], row.GroupKey)
	}
	return memberships, nil
}

// GroupKeys returns the groups a single category may be tagged with. A
// category with no memberships comes back empty.
func (r *CategoriesRepository) GroupKeys(ctx context.Context, categoryID uuid.UUID) ([]string, error) {
	return r.queries.GetCategoryGroupKeys(ctx, categoryID)
}

func (r *CategoriesRepository) DeleteMemberships(ctx context.Context, categoryID uuid.UUID) error {
	return r.queries.DeleteCategoryGroupMembers(ctx, categoryID)
}

func (r *CategoriesRepository) AddMembership(ctx context.Context, categoryID, groupID uuid.UUID) error {
	return r.queries.AddCategoryGroupMember(ctx, postgres.AddCategoryGroupMemberParams{
		ID:         uuid.New(),
		CategoryID: categoryID,
		GroupID:    groupID,
	})
}

// ListActiveWithGroups returns active categories together with every group
// they may be tagged with, one row per (category, group) pair. A category
// with no memberships still comes back once with null group fields.
func (r *CategoriesRepository) ListActiveWithGroups(ctx context.Context) ([]postgres.GetCategoriesWithGroupsRow, error) {
	return r.queries.GetCategoriesWithGroups(ctx)
}

// IsUniqueViolation reports whether the error is a Postgres unique constraint
// violation, used to turn duplicate category/group keys into a clean 409.
func IsUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
