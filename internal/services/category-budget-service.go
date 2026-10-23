package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
)

var (
	ErrNoActiveBudget         = errors.New("no active budget to attach category budgets to")
	ErrCategoryBudgetNotFound = errors.New("category budget not found")
	ErrCategoryBudgetInvalid  = errors.New("allocated amount must be between 0 and 99999999.99")
)

const maxAllocatedAmount = 99_999_999.99

// A category can sit in several groups, but the breakdown shows it once. This
// is the priority used to pick its section. Recurring outranks expenses so a
// category that also occurs as a fixed monthly cost is budgeted there; income
// always comes last because every spending category is mirrored into it for
// split-bill repayments.
var categorySectionPriority = map[string]int{
	"recurring": 1,
	"expenses":  2,
	"transfers": 3,
	"income":    4,
}

// The order the sections are rendered in, independent of the priority used to
// place a multi-group category.
var categoryGroupOrder = map[string]int{
	"expenses":  1,
	"recurring": 2,
	"transfers": 3,
	"income":    4,
}

type CategoryBudgetCategory struct {
	ID               uuid.UUID
	Key              string
	Label            string
	Icon             string
	CategoryBudgetID *uuid.UUID
	Allocated        *string
	Spent            string
}

type CategoryBudgetGroup struct {
	Key        string
	Label      string
	Categories []CategoryBudgetCategory
}

type ActiveBudgetSummary struct {
	ID        uuid.UUID
	Name      string
	StartDate *time.Time
	EndDate   *time.Time
}

type CategoryBudgetOverview struct {
	Budget *ActiveBudgetSummary
	Groups []CategoryBudgetGroup
}

// CategoryBudgetService joins the allocations stored in category_budgets with
// the net spend derived from classified statement rows, so each category can
// be compared against its budget.
type CategoryBudgetService struct {
	store *store.Store
}

func NewCategoryBudgetService(st *store.Store) *CategoryBudgetService {
	return &CategoryBudgetService{store: st}
}

func (s *CategoryBudgetService) Overview(ctx context.Context, userID uuid.UUID) (CategoryBudgetOverview, error) {
	budget, err := s.store.Repos().CategoryBudgets.ActiveBudget(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return CategoryBudgetOverview{}, nil
	}
	if err != nil {
		return CategoryBudgetOverview{}, fmt.Errorf("active budget: %w", err)
	}

	start, end, err := s.window(ctx, userID, budget)
	if err != nil {
		return CategoryBudgetOverview{}, err
	}

	allocations, err := s.store.Repos().CategoryBudgets.ListByBudget(ctx, budget.ID)
	if err != nil {
		return CategoryBudgetOverview{}, fmt.Errorf("category budgets: %w", err)
	}

	spends := map[uuid.UUID]string{}
	if start != nil && end != nil {
		spends, err = s.store.Repos().CategoryBudgets.SpendByUser(ctx, userID, *start, *end)
		if err != nil {
			return CategoryBudgetOverview{}, fmt.Errorf("category spend: %w", err)
		}
	}

	categories, err := s.store.Repos().Categories.ListActiveWithGroups(ctx)
	if err != nil {
		return CategoryBudgetOverview{}, fmt.Errorf("categories: %w", err)
	}

	allocationByCategory := make(map[uuid.UUID]postgres.GetCategoryBudgetsByBudgetRow, len(allocations))
	for _, allocation := range allocations {
		allocationByCategory[allocation.CategoryID] = allocation
	}

	summary := &ActiveBudgetSummary{ID: budget.ID, Name: budget.Name}
	if budget.StartDate.Valid {
		value := budget.StartDate.Time
		summary.StartDate = &value
	}
	if budget.EndDate.Valid {
		value := budget.EndDate.Time
		summary.EndDate = &value
	}

	return CategoryBudgetOverview{
		Budget: summary,
		Groups: groupCategoriesForBudget(categories, allocationByCategory, spends),
	}, nil
}

// SetBudget creates or updates the allocation for a category on the user's
// active budget.
func (s *CategoryBudgetService) SetBudget(ctx context.Context, userID, categoryID uuid.UUID, amount float64) (CategoryBudgetOverview, error) {
	allocated, err := formatAllocated(amount)
	if err != nil {
		return CategoryBudgetOverview{}, err
	}

	err = s.store.Do(ctx, func(repos *store.Repositories) error {
		budget, err := repos.CategoryBudgets.ActiveBudget(ctx, userID)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNoActiveBudget
		}
		if err != nil {
			return err
		}

		if _, err := repos.Categories.GetByID(ctx, categoryID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrCategoryNotFound
			}
			return err
		}

		existing, err := repos.CategoryBudgets.GetByBudgetAndCategory(ctx, budget.ID, categoryID)
		switch {
		case err == nil:
			_, err = repos.CategoryBudgets.Update(ctx, existing.ID, allocated)
			return err
		case errors.Is(err, sql.ErrNoRows):
			_, err = repos.CategoryBudgets.Create(ctx, budget.ID, categoryID, allocated)
			return err
		default:
			return err
		}
	})
	if err != nil {
		return CategoryBudgetOverview{}, err
	}
	return s.Overview(ctx, userID)
}

func (s *CategoryBudgetService) UpdateBudget(ctx context.Context, userID, categoryBudgetID uuid.UUID, amount float64) (CategoryBudgetOverview, error) {
	allocated, err := formatAllocated(amount)
	if err != nil {
		return CategoryBudgetOverview{}, err
	}

	if _, err := s.store.Repos().CategoryBudgets.GetForUser(ctx, categoryBudgetID, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CategoryBudgetOverview{}, ErrCategoryBudgetNotFound
		}
		return CategoryBudgetOverview{}, err
	}

	if _, err := s.store.Repos().CategoryBudgets.Update(ctx, categoryBudgetID, allocated); err != nil {
		return CategoryBudgetOverview{}, fmt.Errorf("update category budget: %w", err)
	}
	return s.Overview(ctx, userID)
}

func (s *CategoryBudgetService) DeleteBudget(ctx context.Context, userID, categoryBudgetID uuid.UUID) (CategoryBudgetOverview, error) {
	if _, err := s.store.Repos().CategoryBudgets.GetForUser(ctx, categoryBudgetID, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CategoryBudgetOverview{}, ErrCategoryBudgetNotFound
		}
		return CategoryBudgetOverview{}, err
	}

	if err := s.store.Repos().CategoryBudgets.SoftDelete(ctx, categoryBudgetID); err != nil {
		return CategoryBudgetOverview{}, fmt.Errorf("delete category budget: %w", err)
	}
	return s.Overview(ctx, userID)
}

// ActiveWindow returns the period the active budget covers, or nil when the
// user has no active budget.
func (s *CategoryBudgetService) ActiveWindow(ctx context.Context, userID uuid.UUID) (*time.Time, *time.Time, error) {
	budget, err := s.store.Repos().CategoryBudgets.ActiveBudget(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("active budget: %w", err)
	}
	return s.window(ctx, userID, budget)
}

// window is the active budget's own period. Some legacy budgets have no dates,
// in which case the v2 preference window stands in.
func (s *CategoryBudgetService) window(ctx context.Context, userID uuid.UUID, budget postgres.Budget) (*time.Time, *time.Time, error) {
	if budget.StartDate.Valid && budget.EndDate.Valid {
		start, end := budget.StartDate.Time, budget.EndDate.Time
		return &start, &end, nil
	}

	preference, err := s.store.Repos().Budget.GetByUser(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("budget preference: %w", err)
	}
	return &preference.StartDate, &preference.EndDate, nil
}

type budgetCategoryAccumulator struct {
	id         uuid.UUID
	key        string
	label      string
	icon       string
	groupKey   string
	groupLabel string
}

// groupCategoriesForBudget turns the category/group pair rows into one entry
// per category under its highest-priority group, with allocation and spend
// attached.
func groupCategoriesForBudget(
	rows []postgres.GetCategoriesWithGroupsRow,
	allocations map[uuid.UUID]postgres.GetCategoryBudgetsByBudgetRow,
	spends map[uuid.UUID]string,
) []CategoryBudgetGroup {
	order := make([]uuid.UUID, 0)
	byID := make(map[uuid.UUID]*budgetCategoryAccumulator, len(rows))

	for _, row := range rows {
		account, ok := byID[row.ID]
		if !ok {
			account = &budgetCategoryAccumulator{
				id:    row.ID,
				key:   row.Key,
				label: row.Label,
				icon:  row.Icon,
			}
			byID[row.ID] = account
			order = append(order, row.ID)
		}
		if !row.GroupID.Valid {
			continue
		}
		if account.groupKey == "" || sectionPriority(row.GroupKey.String) < sectionPriority(account.groupKey) {
			account.groupKey = row.GroupKey.String
			account.groupLabel = row.GroupLabel.String
		}
	}

	groupsByKey := make(map[string]*CategoryBudgetGroup)
	groupOrder := make([]string, 0)
	for _, id := range order {
		account := byID[id]
		groupKey := account.groupKey
		groupLabel := account.groupLabel
		if groupKey == "" {
			groupKey = "other"
			groupLabel = "Other"
		}

		group, ok := groupsByKey[groupKey]
		if !ok {
			group = &CategoryBudgetGroup{
				Key:        groupKey,
				Label:      groupLabel,
				Categories: []CategoryBudgetCategory{},
			}
			groupsByKey[groupKey] = group
			groupOrder = append(groupOrder, groupKey)
		}

		category := CategoryBudgetCategory{
			ID:    account.id,
			Key:   account.key,
			Label: account.label,
			Icon:  account.icon,
			Spent: "0.00",
		}
		if spent, ok := spends[account.id]; ok {
			category.Spent = spent
		}
		if allocation, ok := allocations[account.id]; ok {
			id := allocation.ID
			allocated := allocation.AllocatedAmount
			category.CategoryBudgetID = &id
			category.Allocated = &allocated
		}

		group.Categories = append(group.Categories, category)
	}

	groups := make([]CategoryBudgetGroup, 0, len(groupOrder))
	for _, key := range groupOrder {
		group := groupsByKey[key]
		sort.SliceStable(group.Categories, func(i, j int) bool {
			return group.Categories[i].Label < group.Categories[j].Label
		})
		groups = append(groups, *group)
	}
	sort.SliceStable(groups, func(i, j int) bool {
		if groupOrderRank(groups[i].Key) != groupOrderRank(groups[j].Key) {
			return groupOrderRank(groups[i].Key) < groupOrderRank(groups[j].Key)
		}
		return groups[i].Label < groups[j].Label
	})

	return groups
}

func sectionPriority(key string) int {
	if priority, ok := categorySectionPriority[key]; ok {
		return priority
	}
	return 5
}

func groupOrderRank(key string) int {
	if order, ok := categoryGroupOrder[key]; ok {
		return order
	}
	return 5
}

func formatAllocated(amount float64) (string, error) {
	if math.IsNaN(amount) || math.IsInf(amount, 0) || amount < 0 || amount > maxAllocatedAmount {
		return "", ErrCategoryBudgetInvalid
	}
	return strconv.FormatFloat(amount, 'f', 2, 64), nil
}
