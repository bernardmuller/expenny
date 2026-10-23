package services

import (
	"database/sql"
	"testing"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
)

func TestGroupCategoriesForBudgetSplitsCategoryByTransactionGroup(t *testing.T) {
	recurring := uuid.New()
	expenses := uuid.New()
	utilities := uuid.New()
	groceries := uuid.New()
	allocationID := uuid.New()

	text := func(value string) sql.NullString {
		return sql.NullString{String: value, Valid: true}
	}
	groupRef := func(id uuid.UUID) uuid.NullUUID {
		return uuid.NullUUID{UUID: id, Valid: true}
	}

	// Utilities is both a recurring cost and a general expense. The spend is
	// split by the group each transaction was actually tagged with.
	rows := []postgres.GetCategoriesWithGroupsRow{
		{
			ID: groceries, Key: "groceries", Label: "Groceries", Icon: "🛒",
			GroupID: groupRef(expenses), GroupKey: text("expenses"), GroupLabel: text("Expenses"),
		},
		{
			ID: utilities, Key: "utilities", Label: "Utilities", Icon: "💡",
			GroupID: groupRef(expenses), GroupKey: text("expenses"), GroupLabel: text("Expenses"),
		},
		{
			ID: utilities, Key: "utilities", Label: "Utilities", Icon: "💡",
			GroupID: groupRef(recurring), GroupKey: text("recurring"), GroupLabel: text("Recurring"),
		},
	}

	spends := []postgres.GetCategorySpendByGroupByUserRow{
		{CategoryID: groceries, GroupKey: "expenses", GroupLabel: "Expenses", Spent: "4200.00"},
		{CategoryID: utilities, GroupKey: "expenses", GroupLabel: "Expenses", Spent: "100.00"},
		{CategoryID: utilities, GroupKey: "recurring", GroupLabel: "Recurring", Spent: "1299.00"},
	}
	allocations := map[uuid.UUID]postgres.GetCategoryBudgetsByBudgetRow{
		utilities: {ID: allocationID, CategoryID: utilities, AllocatedAmount: "1500.00"},
	}
	groups := groupCategoriesForBudget(rows, allocations, spends)
	if len(groups) != 2 {
		t.Fatalf("got %d groups, want 2", len(groups))
	}
	if groups[0].Key != "expenses" || groups[1].Key != "recurring" {
		t.Fatalf("groups = %q, %q; want expenses then recurring", groups[0].Key, groups[1].Key)
	}

	if len(groups[0].Categories) != 2 {
		t.Fatalf("expenses categories = %+v, want groceries and utilities", groups[0].Categories)
	}
	utilitiesExpenses := groups[0].Categories[1]
	if utilitiesExpenses.ID != utilities || utilitiesExpenses.GroupKey != "expenses" || utilitiesExpenses.Spent != "100.00" {
		t.Errorf("expenses utilities = %+v, want utilities/expenses/100.00", utilitiesExpenses)
	}
	if utilitiesExpenses.Allocated == nil || *utilitiesExpenses.Allocated != "1500.00" {
		t.Errorf("expenses utilities allocated = %v, want 1500.00", utilitiesExpenses.Allocated)
	}

	if len(groups[1].Categories) != 1 {
		t.Fatalf("recurring categories = %+v, want utilities", groups[1].Categories)
	}
	utilitiesRecurring := groups[1].Categories[0]
	if utilitiesRecurring.ID != utilities || utilitiesRecurring.GroupKey != "recurring" || utilitiesRecurring.Spent != "1299.00" {
		t.Errorf("recurring utilities = %+v, want utilities/recurring/1299.00", utilitiesRecurring)
	}
	if utilitiesRecurring.CategoryBudgetID == nil || *utilitiesRecurring.CategoryBudgetID != allocationID {
		t.Errorf("recurring utilities budget id = %v, want %s", utilitiesRecurring.CategoryBudgetID, allocationID)
	}
}

func TestGroupCategoriesForBudgetFallsBackToMembershipWithoutSpend(t *testing.T) {
	recurring := uuid.New()
	expenses := uuid.New()
	utilities := uuid.New()

	text := func(value string) sql.NullString {
		return sql.NullString{String: value, Valid: true}
	}
	groupRef := func(id uuid.UUID) uuid.NullUUID {
		return uuid.NullUUID{UUID: id, Valid: true}
	}

	rows := []postgres.GetCategoriesWithGroupsRow{
		{
			ID: utilities, Key: "utilities", Label: "Utilities", Icon: "💡",
			GroupID: groupRef(expenses), GroupKey: text("expenses"), GroupLabel: text("Expenses"),
		},
		{
			ID: utilities, Key: "utilities", Label: "Utilities", Icon: "💡",
			GroupID: groupRef(recurring), GroupKey: text("recurring"), GroupLabel: text("Recurring"),
		},
	}

	groups := groupCategoriesForBudget(rows, nil, nil)
	if len(groups) != 1 || groups[0].Key != "recurring" {
		t.Fatalf("groups = %+v, want one recurring group", groups)
	}
	if groups[0].Categories[0].Spent != "0.00" {
		t.Errorf("spend = %q, want 0.00", groups[0].Categories[0].Spent)
	}
}

func TestGroupCategoriesForBudgetShowsLegacySpendUnderOther(t *testing.T) {
	expenses := uuid.New()
	groceries := uuid.New()

	text := func(value string) sql.NullString {
		return sql.NullString{String: value, Valid: true}
	}
	groupRef := func(id uuid.UUID) uuid.NullUUID {
		return uuid.NullUUID{UUID: id, Valid: true}
	}

	rows := []postgres.GetCategoriesWithGroupsRow{
		{
			ID: groceries, Key: "groceries", Label: "Groceries", Icon: "🛒",
			GroupID: groupRef(expenses), GroupKey: text("expenses"), GroupLabel: text("Expenses"),
		},
	}
	spends := []postgres.GetCategorySpendByGroupByUserRow{
		{CategoryID: groceries, GroupKey: "", GroupLabel: "", Spent: "50.00"},
	}

	groups := groupCategoriesForBudget(rows, nil, spends)
	if len(groups) != 1 || groups[0].Key != "other" || groups[0].Label != "Other" {
		t.Fatalf("groups = %+v, want one Other group", groups)
	}
	category := groups[0].Categories[0]
	if category.GroupKey != "" || category.Spent != "50.00" {
		t.Errorf("category = %+v, want empty group key and 50.00 spend", category)
	}
}

func TestFormatAllocated(t *testing.T) {
	tests := []struct {
		name    string
		amount  float64
		want    string
		wantErr bool
	}{
		{name: "formats to two decimals", amount: 1500, want: "1500.00"},
		{name: "zero is allowed", amount: 0, want: "0.00"},
		{name: "rejects negatives", amount: -1, wantErr: true},
		{name: "rejects more than the column allows", amount: 100_000_000, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := formatAllocated(tt.amount)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("formatAllocated() error = %v", err)
			}
			if got != tt.want {
				t.Errorf("formatAllocated() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestGroupCategoriesForBudget(t *testing.T) {
	expenses := uuid.New()
	income := uuid.New()
	groceries := uuid.New()
	salary := uuid.New()
	allocationID := uuid.New()

	text := func(value string) sql.NullString {
		return sql.NullString{String: value, Valid: true}
	}
	groupRef := func(id uuid.UUID) uuid.NullUUID {
		return uuid.NullUUID{UUID: id, Valid: true}
	}

	// Groceries is mirrored into income, like every spending category, but
	// its transactions are tagged as expenses. The spend stays in Expenses.
	rows := []postgres.GetCategoriesWithGroupsRow{
		{
			ID: groceries, Key: "groceries", Label: "Groceries", Icon: "🛒",
			GroupID: groupRef(income), GroupKey: text("income"), GroupLabel: text("Income"),
		},
		{
			ID: groceries, Key: "groceries", Label: "Groceries", Icon: "🛒",
			GroupID: groupRef(expenses), GroupKey: text("expenses"), GroupLabel: text("Expenses"),
		},
		{
			ID: salary, Key: "salary", Label: "Salary", Icon: "💼",
			GroupID: groupRef(income), GroupKey: text("income"), GroupLabel: text("Income"),
		},
	}

	allocations := map[uuid.UUID]postgres.GetCategoryBudgetsByBudgetRow{
		groceries: {
			ID: allocationID, CategoryID: groceries, AllocatedAmount: "5000.00",
			CategoryKey: "groceries", CategoryLabel: "Groceries", CategoryIcon: "🛒",
		},
	}
	spends := []postgres.GetCategorySpendByGroupByUserRow{
		{CategoryID: groceries, GroupKey: "expenses", GroupLabel: "Expenses", Spent: "4200.00"},
	}

	groups := groupCategoriesForBudget(rows, allocations, spends)
	if len(groups) != 2 {
		t.Fatalf("got %d groups, want 2", len(groups))
	}
	if groups[0].Key != "expenses" || groups[1].Key != "income" {
		t.Fatalf("groups = %q, %q; want expenses then income", groups[0].Key, groups[1].Key)
	}

	groceriesRow := groups[0].Categories[0]
	if groceriesRow.Key != "groceries" {
		t.Errorf("expenses category = %q, want groceries", groceriesRow.Key)
	}
	if groceriesRow.Allocated == nil || *groceriesRow.Allocated != "5000.00" {
		t.Errorf("allocated = %v, want 5000.00", groceriesRow.Allocated)
	}
	if groceriesRow.Spent != "4200.00" {
		t.Errorf("spent = %q, want 4200.00", groceriesRow.Spent)
	}
	if groceriesRow.CategoryBudgetID == nil || *groceriesRow.CategoryBudgetID != allocationID {
		t.Errorf("category budget id = %v, want %s", groceriesRow.CategoryBudgetID, allocationID)
	}

	if groups[1].Categories[0].Key != "salary" {
		t.Errorf("income category = %q, want salary", groups[1].Categories[0].Key)
	}
	if groups[1].Categories[0].Allocated != nil {
		t.Errorf("salary allocated = %v, want nil", groups[1].Categories[0].Allocated)
	}
}
