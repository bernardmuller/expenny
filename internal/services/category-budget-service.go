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

// Categories with spend follow the transaction groups on their rows. This
// priority only decides where a category without any spend in the window is
// shown, so its allocation remains visible. Recurring outranks expenses so a
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
	ID    uuid.UUID
	Key   string
	Label string
	Icon  string
	// GroupKey is the transaction group this row's spend belongs to. It is
	// empty for spend rows that predate group decisions.
	GroupKey         string
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

	var spends []postgres.GetCategorySpendByGroupByUserRow
	if start != nil && end != nil {
		spends, err = s.store.Repos().CategoryBudgets.SpendByGroupByUser(ctx, userID, *start, *end)
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

type budgetCategoryMembership struct {
	key   string
	label string
}

type budgetCategoryAccumulator struct {
	id          uuid.UUID
	key         string
	label       string
	icon        string
	memberships []budgetCategoryMembership
}

type budgetCategorySpend struct {
	groupKey            string
	groupLabel          string
	transactionGroupKey string
	spent               string
}

// groupCategoriesForBudget turns the category/group pair rows into budget
// rows. A category with spend is shown once per transaction group it was
// actually tagged with, so moving a single row from Recurring to Expenses
// moves that spend with it. Categories without any spend fall back to their
// highest-priority membership so their allocation is still visible.
func groupCategoriesForBudget(
	rows []postgres.GetCategoriesWithGroupsRow,
	allocations map[uuid.UUID]postgres.GetCategoryBudgetsByBudgetRow,
	spends []postgres.GetCategorySpendByGroupByUserRow,
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
		account.memberships = append(account.memberships, budgetCategoryMembership{
			key:   row.GroupKey.String,
			label: row.GroupLabel.String,
		})
	}

	spendsByCategory := make(map[uuid.UUID][]postgres.GetCategorySpendByGroupByUserRow, len(spends))
	for _, spend := range spends {
		spendsByCategory[spend.CategoryID] = append(spendsByCategory[spend.CategoryID], spend)
	}

	groupsByKey := make(map[string]*CategoryBudgetGroup)
	groupOrder := make([]string, 0)
	for _, id := range order {
		account := byID[id]
		for _, spend := range budgetSpendsFor(account, spendsByCategory[id]) {
			group, ok := groupsByKey[spend.groupKey]
			if !ok {
				group = &CategoryBudgetGroup{
					Key:        spend.groupKey,
					Label:      spend.groupLabel,
					Categories: []CategoryBudgetCategory{},
				}
				groupsByKey[spend.groupKey] = group
				groupOrder = append(groupOrder, spend.groupKey)
			}
			if group.Label == "" {
				group.Label = spend.groupLabel
			}

			category := CategoryBudgetCategory{
				ID:       account.id,
				Key:      account.key,
				Label:    account.label,
				Icon:     account.icon,
				GroupKey: spend.transactionGroupKey,
				Spent:    spend.spent,
			}
			if allocation, ok := allocations[account.id]; ok {
				allocationID := allocation.ID
				allocated := allocation.AllocatedAmount
				category.CategoryBudgetID = &allocationID
				category.Allocated = &allocated
			}

			group.Categories = append(group.Categories, category)
		}
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

// budgetSpendsFor returns one row per group the category's transactions were
// tagged with. Rows that predate group decisions land under Other. Rows that
// collapse onto the same section are summed.
func budgetSpendsFor(account *budgetCategoryAccumulator, spends []postgres.GetCategorySpendByGroupByUserRow) []budgetCategorySpend {
	if len(spends) == 0 {
		groupKey, groupLabel := fallbackGroup(account)
		return []budgetCategorySpend{{
			groupKey:            groupKey,
			groupLabel:          groupLabel,
			transactionGroupKey: groupKey,
			spent:               "0.00",
		}}
	}

	byKey := make(map[string]int, len(spends))
	rows := make([]budgetCategorySpend, 0, len(spends))

	for _, spend := range spends {
		groupKey := spend.GroupKey
		groupLabel := spend.GroupLabel
		if groupKey == "" {
			groupKey = "other"
			groupLabel = "Other"
		} else if groupLabel == "" {
			groupLabel = groupLabelFor(account, groupKey)
		}

		if index, ok := byKey[groupKey]; ok {
			rows[index].spent = addAmounts(rows[index].spent, spend.Spent)
			if rows[index].groupLabel == "" {
				rows[index].groupLabel = groupLabel
			}
			continue
		}

		byKey[groupKey] = len(rows)
		rows = append(rows, budgetCategorySpend{
			groupKey:            groupKey,
			groupLabel:          groupLabel,
			transactionGroupKey: spend.GroupKey,
			spent:               spend.Spent,
		})
	}

	return rows
}

func fallbackGroup(account *budgetCategoryAccumulator) (string, string) {
	if len(account.memberships) == 0 {
		return "other", "Other"
	}

	best := account.memberships[0]
	for _, membership := range account.memberships[1:] {
		if sectionPriority(membership.key) < sectionPriority(best.key) {
			best = membership
		}
	}
	if best.key == "" {
		return "other", "Other"
	}
	return best.key, best.label
}

func groupLabelFor(account *budgetCategoryAccumulator, groupKey string) string {
	for _, membership := range account.memberships {
		if membership.key == groupKey {
			return membership.label
		}
	}
	if groupKey == "" || groupKey == "other" {
		return "Other"
	}
	return groupKey
}

func addAmounts(left, right string) string {
	leftValue, _ := strconv.ParseFloat(left, 64)
	rightValue, _ := strconv.ParseFloat(right, 64)
	return strconv.FormatFloat(leftValue+rightValue, 'f', 2, 64)
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
