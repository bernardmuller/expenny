package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"expenny.co.za/internal/categories"
	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
)

var (
	ErrCategoryNotFound      = errors.New("category not found")
	ErrCategoryKeyTaken      = errors.New("a category with that key already exists")
	ErrCategoryInvalid       = errors.New("category key and label are required")
	ErrCategoryGroupNotFound = errors.New("category group not found")
	ErrCategoryGroupKeyTaken = errors.New("a category group with that key already exists")
	ErrCategoryGroupInvalid  = errors.New("category group key and label are required")
)

// categoryKeyPattern keeps keys slug-like because they are what the classifier
// answers with and what past corrections are stored against.
var categoryKeyPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type CategoryGroupView struct {
	ID    uuid.UUID
	Key   string
	Label string
}

type CategoryView struct {
	ID     uuid.UUID
	Key    string
	Label  string
	Icon   string
	Groups []CategoryGroupView
}

type CategoryInput struct {
	Key   string
	Label string
	Icon  string
	// GroupIDs replaces the category's memberships when non-nil. An empty
	// slice clears them; nil leaves them untouched (update only).
	GroupIDs *[]uuid.UUID
}

// CategoryService owns the category and category group dictionaries and the
// memberships between them.
type CategoryService struct {
	store *store.Store
}

func NewCategoryService(st *store.Store) *CategoryService {
	return &CategoryService{store: st}
}

// ListCategories returns active categories with the groups they may be tagged
// with, aggregated from the membership join table.
func (s *CategoryService) ListCategories(ctx context.Context) ([]CategoryView, error) {
	rows, err := s.store.Repos().Categories.ListActiveWithGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("list categories: %w", err)
	}

	views := make([]CategoryView, 0)
	indexByID := make(map[uuid.UUID]int, len(rows))
	for _, row := range rows {
		index, ok := indexByID[row.ID]
		if !ok {
			views = append(views, CategoryView{
				ID:     row.ID,
				Key:    row.Key,
				Label:  row.Label,
				Icon:   row.Icon,
				Groups: []CategoryGroupView{},
			})
			index = len(views) - 1
			indexByID[row.ID] = index
		}
		if row.GroupID.Valid {
			views[index].Groups = append(views[index].Groups, CategoryGroupView{
				ID:    row.GroupID.UUID,
				Key:   row.GroupKey.String,
				Label: row.GroupLabel.String,
			})
		}
	}

	return views, nil
}

// CreateCategory inserts a category, reviving a soft-deleted one when the key
// was used before so historical classifications keep pointing at it.
func (s *CategoryService) CreateCategory(ctx context.Context, in CategoryInput) (CategoryView, error) {
	normalized, err := normalizeCategoryInput(in)
	if err != nil {
		return CategoryView{}, err
	}

	var categoryID uuid.UUID
	err = s.store.Do(ctx, func(repos *store.Repositories) error {
		existing, err := repos.Categories.GetByKey(ctx, normalized.Key)
		switch {
		case err == nil && !existing.DeletedAt.Valid:
			return ErrCategoryKeyTaken
		case err == nil:
			restored, err := repos.Categories.Restore(ctx, existing.ID, normalized.Key, normalized.Label, normalized.Icon)
			if err != nil {
				return err
			}
			categoryID = restored.ID
		case errors.Is(err, sql.ErrNoRows):
			created, err := repos.Categories.Create(ctx, normalized.Key, normalized.Label, normalized.Icon)
			if err != nil {
				if categories.IsUniqueViolation(err) {
					return ErrCategoryKeyTaken
				}
				return err
			}
			categoryID = created.ID
		default:
			return err
		}

		if normalized.GroupIDs != nil {
			return replaceMemberships(ctx, repos, categoryID, *normalized.GroupIDs)
		}
		return nil
	})
	if err != nil {
		return CategoryView{}, err
	}
	return s.category(ctx, categoryID)
}

func (s *CategoryService) UpdateCategory(ctx context.Context, id uuid.UUID, in CategoryInput) (CategoryView, error) {
	normalized, err := normalizeCategoryInput(in)
	if err != nil {
		return CategoryView{}, err
	}

	err = s.store.Do(ctx, func(repos *store.Repositories) error {
		existing, err := repos.Categories.GetByID(ctx, id)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrCategoryNotFound
		}
		if err != nil {
			return err
		}
		if existing.DeletedAt.Valid {
			return ErrCategoryNotFound
		}

		other, err := repos.Categories.GetByKey(ctx, normalized.Key)
		switch {
		case err == nil && other.ID != id:
			return ErrCategoryKeyTaken
		case err != nil && !errors.Is(err, sql.ErrNoRows):
			return err
		}

		if _, err := repos.Categories.Update(ctx, id, normalized.Key, normalized.Label, normalized.Icon); err != nil {
			if categories.IsUniqueViolation(err) {
				return ErrCategoryKeyTaken
			}
			return err
		}

		if normalized.GroupIDs != nil {
			return replaceMemberships(ctx, repos, id, *normalized.GroupIDs)
		}
		return nil
	})
	if err != nil {
		return CategoryView{}, err
	}
	return s.category(ctx, id)
}

// DeleteCategory soft-deletes the category. Classifications keep their
// category id and the row can be revived by creating the same key again.
func (s *CategoryService) DeleteCategory(ctx context.Context, id uuid.UUID) error {
	return s.store.Do(ctx, func(repos *store.Repositories) error {
		existing, err := repos.Categories.GetByID(ctx, id)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrCategoryNotFound
		}
		if err != nil {
			return err
		}
		if existing.DeletedAt.Valid {
			return ErrCategoryNotFound
		}
		return repos.Categories.SoftDelete(ctx, id)
	})
}

func (s *CategoryService) ListGroups(ctx context.Context) ([]CategoryGroupView, error) {
	groups, err := s.store.Repos().Categories.Groups(ctx)
	if err != nil {
		return nil, fmt.Errorf("list category groups: %w", err)
	}

	views := make([]CategoryGroupView, 0, len(groups))
	for _, group := range groups {
		views = append(views, CategoryGroupView{ID: group.ID, Key: group.Key, Label: group.Label})
	}
	return views, nil
}

func (s *CategoryService) CreateGroup(ctx context.Context, key, label string) (CategoryGroupView, error) {
	key, label, err := normalizeGroupInput(key, label)
	if err != nil {
		return CategoryGroupView{}, err
	}

	group, err := s.store.Repos().Categories.CreateGroup(ctx, key, label)
	if err != nil {
		if categories.IsUniqueViolation(err) {
			return CategoryGroupView{}, ErrCategoryGroupKeyTaken
		}
		return CategoryGroupView{}, fmt.Errorf("create category group: %w", err)
	}
	return CategoryGroupView{ID: group.ID, Key: group.Key, Label: group.Label}, nil
}

func (s *CategoryService) UpdateGroup(ctx context.Context, id uuid.UUID, key, label string) (CategoryGroupView, error) {
	key, label, err := normalizeGroupInput(key, label)
	if err != nil {
		return CategoryGroupView{}, err
	}

	var updated postgres.CategoryGroup
	err = s.store.Do(ctx, func(repos *store.Repositories) error {
		if _, err := repos.Categories.GetGroupByID(ctx, id); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrCategoryGroupNotFound
			}
			return err
		}
		updated, err = repos.Categories.UpdateGroup(ctx, id, key, label)
		return err
	})
	if err != nil {
		if categories.IsUniqueViolation(err) {
			return CategoryGroupView{}, ErrCategoryGroupKeyTaken
		}
		return CategoryGroupView{}, err
	}
	return CategoryGroupView{ID: updated.ID, Key: updated.Key, Label: updated.Label}, nil
}

// DeleteGroup removes the group. Memberships cascade; classifications that
// used the group keep its key as a text snapshot.
func (s *CategoryService) DeleteGroup(ctx context.Context, id uuid.UUID) error {
	return s.store.Do(ctx, func(repos *store.Repositories) error {
		if _, err := repos.Categories.GetGroupByID(ctx, id); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrCategoryGroupNotFound
			}
			return err
		}
		return repos.Categories.DeleteGroup(ctx, id)
	})
}

func (s *CategoryService) category(ctx context.Context, id uuid.UUID) (CategoryView, error) {
	views, err := s.ListCategories(ctx)
	if err != nil {
		return CategoryView{}, err
	}
	for _, view := range views {
		if view.ID == id {
			return view, nil
		}
	}
	return CategoryView{}, ErrCategoryNotFound
}

func replaceMemberships(ctx context.Context, repos *store.Repositories, categoryID uuid.UUID, groupIDs []uuid.UUID) error {
	// Validate first so an unknown group id fails before anything is deleted.
	seen := make(map[uuid.UUID]struct{}, len(groupIDs))
	for _, groupID := range groupIDs {
		if _, ok := seen[groupID]; ok {
			continue
		}
		if _, err := repos.Categories.GetGroupByID(ctx, groupID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrCategoryGroupNotFound
			}
			return err
		}
		seen[groupID] = struct{}{}
	}

	if err := repos.Categories.DeleteMemberships(ctx, categoryID); err != nil {
		return err
	}
	for groupID := range seen {
		if err := repos.Categories.AddMembership(ctx, categoryID, groupID); err != nil {
			return err
		}
	}
	return nil
}

func normalizeCategoryInput(in CategoryInput) (CategoryInput, error) {
	in.Key = strings.ToLower(strings.TrimSpace(in.Key))
	in.Label = strings.TrimSpace(in.Label)
	in.Icon = strings.TrimSpace(in.Icon)

	if in.Key == "" || in.Label == "" || !categoryKeyPattern.MatchString(in.Key) {
		return in, ErrCategoryInvalid
	}
	if utf8.RuneCountInString(in.Label) > 100 || utf8.RuneCountInString(in.Icon) > 10 {
		return in, ErrCategoryInvalid
	}
	return in, nil
}

func normalizeGroupInput(key, label string) (string, string, error) {
	key = strings.ToLower(strings.TrimSpace(key))
	label = strings.TrimSpace(label)

	if key == "" || label == "" || !categoryKeyPattern.MatchString(key) {
		return "", "", ErrCategoryGroupInvalid
	}
	if utf8.RuneCountInString(label) > 100 {
		return "", "", ErrCategoryGroupInvalid
	}
	return key, label, nil
}
