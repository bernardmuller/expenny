package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/budget"
	"expenny.co.za/internal/store"
)

var (
	// ErrBudgetWindowInvalid rejects a window whose end lands before its start.
	ErrBudgetWindowInvalid = errors.New("budget end date must be on or after the start date")
)

// BudgetPreference is the user's configured window.
type BudgetPreference struct {
	Account   *string
	StartDate time.Time
	EndDate   time.Time
}

// BudgetSalary is the transaction whose amount anchors the window: the latest
// row categorised as salary inside it.
type BudgetSalary struct {
	ID                  uuid.UUID
	Description         string
	OriginalDescription string
	TransactionDate     time.Time
	Amount              string
}

// BudgetOverview is everything the dashboard card needs: the latest statement
// balance, the salary anchor, and the arithmetic between them.
type BudgetOverview struct {
	Preferences    *BudgetPreference
	CurrentBalance *string
	SalaryAmount   *string
	Salary         *BudgetSalary
	SpentAmount    *string
	Accounts       []string
}

// BudgetService derives the current budget from the statement instead of a
// manually maintained amount: the big number is the latest balance the bank
// reported, and the window total is the salary credited inside
// budget_preferences.
type BudgetService struct {
	store *store.Store
}

func NewBudgetService(st *store.Store) *BudgetService {
	return &BudgetService{store: st}
}

// Overview reads the preference, the latest balance, and the salary anchor.
// A missing preference is not an error: the balance is still returned and the
// client can prompt for a window.
func (s *BudgetService) Overview(ctx context.Context, userID uuid.UUID) (BudgetOverview, error) {
	accounts, err := s.store.Repos().Statements.ListAccounts(ctx, userID)
	if err != nil {
		return BudgetOverview{}, fmt.Errorf("list accounts: %w", err)
	}
	if accounts == nil {
		accounts = []string{}
	}
	overview := BudgetOverview{Accounts: accounts}

	preference, err := s.store.Repos().Budget.GetByUser(ctx, userID)
	configured := true
	account := ""

	switch {
	case err == nil:
		overview.Preferences = &BudgetPreference{
			Account:   nullStringPtr(preference.Account),
			StartDate: preference.StartDate,
			EndDate:   preference.EndDate,
		}
		if preference.Account.Valid {
			account = preference.Account.String
		}
	case errors.Is(err, sql.ErrNoRows):
		// Fall back to the v1 active budget's period when the user has not
		// configured a v2 preference yet, so the card still has a window and a
		// days-left badge.
		active, activeErr := s.store.Repos().CategoryBudgets.ActiveBudget(ctx, userID)
		if activeErr != nil && !errors.Is(activeErr, sql.ErrNoRows) {
			return BudgetOverview{}, fmt.Errorf("active budget: %w", activeErr)
		}
		if activeErr == nil && active.StartDate.Valid && active.EndDate.Valid {
			overview.Preferences = &BudgetPreference{
				StartDate: active.StartDate.Time,
				EndDate:   active.EndDate.Time,
			}
		} else {
			configured = false
		}
	default:
		return BudgetOverview{}, fmt.Errorf("budget preference: %w", err)
	}

	balance, err := s.store.Repos().Statements.LatestBalance(ctx, userID, account)
	switch {
	case err == nil:
		overview.CurrentBalance = &balance
	case errors.Is(err, sql.ErrNoRows):
	default:
		return BudgetOverview{}, fmt.Errorf("latest balance: %w", err)
	}

	if !configured {
		return overview, nil
	}

	salary, err := s.resolveSalary(ctx, userID, overview.Preferences.StartDate, overview.Preferences.EndDate, account)
	if err != nil {
		return BudgetOverview{}, err
	}
	overview.Salary = salary
	if salary != nil {
		overview.SalaryAmount = &salary.Amount
		if overview.CurrentBalance != nil {
			spent := formatAmount(parseAmount(salary.Amount) - parseAmount(*overview.CurrentBalance))
			overview.SpentAmount = &spent
		}
	}

	return overview, nil
}

// SetPreferences stores the window and returns the recomputed overview.
func (s *BudgetService) SetPreferences(ctx context.Context, userID uuid.UUID, start, end time.Time, account *string) (BudgetOverview, error) {
	if end.Before(start) {
		return BudgetOverview{}, ErrBudgetWindowInvalid
	}

	if _, err := s.store.Repos().Budget.Upsert(ctx, userID, budget.UpsertBudgetPreferenceDTO{
		Account:   account,
		StartDate: start,
		EndDate:   end,
	}); err != nil {
		return BudgetOverview{}, fmt.Errorf("save budget preference: %w", err)
	}

	return s.Overview(ctx, userID)
}

// resolveSalary takes the latest row in the window categorised as salary. The
// category is the flag: it does not matter whether the classifier chose it or
// a human corrected the row, because both write the same classification.
func (s *BudgetService) resolveSalary(ctx context.Context, userID uuid.UUID, start, end time.Time, account string) (*BudgetSalary, error) {
	row, err := s.store.Repos().Statements.LatestSalary(
		ctx,
		userID,
		start,
		end.AddDate(0, 0, 1),
		account,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("latest salary: %w", err)
	}

	return &BudgetSalary{
		ID:                  row.ID,
		Description:         row.Description,
		OriginalDescription: row.OriginalDescription,
		TransactionDate:     row.TransactionDate,
		Amount:              row.MoneyIn,
	}, nil
}

func parseAmount(value string) float64 {
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func formatAmount(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64)
}

func nullStringPtr(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}
