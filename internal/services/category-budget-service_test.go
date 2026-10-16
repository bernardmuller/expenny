package services

import (
	"database/sql"
	"testing"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
)

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

	// Groceries is mirrored into income, like every spending category. The
	// breakdown should still file it under Expenses.
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
	spends := map[uuid.UUID]string{groceries: "4200.00"}

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
