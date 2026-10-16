package services

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/classifications"
	"expenny.co.za/internal/classifier"
	"expenny.co.za/internal/corrections"
	"expenny.co.za/internal/statements"
	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
)

// ClassificationsService runs the classifier over parsed statement rows and
// stores its verdict next to the row it belongs to.
type ClassificationsService struct {
	store    *store.Store
	provider classifier.Provider
}

func NewClassificationsService(st *store.Store, provider classifier.Provider) *ClassificationsService {
	return &ClassificationsService{store: st, provider: provider}
}

// Classify classifies txns and upserts one classification per stored row,
// returning the per-row results in the same order as txns. rows must line up
// with txns by index; IngestionService guarantees that because it stores the
// parsed transactions in order.
//
// A provider failure for an individual row is reported on that row's Result
// and does not fail the whole call, so the rows that did classify are saved.
func (s *ClassificationsService) Classify(
	ctx context.Context,
	userID uuid.UUID,
	txns []statements.Transaction,
	rows []postgres.StatementTransaction,
) ([]classifier.Result, error) {
	if len(txns) == 0 {
		return nil, nil
	}
	if len(rows) != len(txns) {
		return nil, fmt.Errorf("classify: %d parsed transactions but %d stored rows", len(txns), len(rows))
	}

	byKey, byID, err := s.categories(ctx)
	if err != nil {
		return nil, err
	}

	groups, err := s.store.Repos().Categories.Groups(ctx)
	if err != nil {
		return nil, fmt.Errorf("load category groups: %w", err)
	}

	memberships, err := s.store.Repos().Categories.Memberships(ctx)
	if err != nil {
		return nil, fmt.Errorf("load category group memberships: %w", err)
	}

	known, err := s.knownCorrections(ctx, userID, byID)
	if err != nil {
		return nil, err
	}

	options := make(map[string]string, len(byKey))
	membershipsByKey := make(map[string][]string, len(byKey))
	for key, category := range byKey {
		options[key] = category.Label
		if allowed := memberships[category.ID]; len(allowed) > 0 {
			membershipsByKey[key] = allowed
		}
	}

	groupOptions := make(map[string]string, len(groups))
	for _, group := range groups {
		groupOptions[group.Key] = group.Label
	}

	c := classifier.New(classifier.Config{
		Provider:    s.provider,
		Categories:  options,
		Groups:      groupOptions,
		Memberships: membershipsByKey,
		Known:       known,
	})

	results := c.Classify(ctx, txns)

	// A category can sit in several groups, so validate the provider's pair
	// and fall back to a direction-appropriate membership when it is illegal.
	for i := range results {
		if results[i].Err != nil {
			continue
		}
		category, ok := byKey[results[i].Category]
		if !ok {
			results[i].Group = ""
			continue
		}
		results[i].Group = resolveGroup(
			results[i].Group,
			memberships[category.ID],
			results[i].Expense >= 0.5,
		)
	}

	if err := s.save(ctx, rows, results, byKey); err != nil {
		return results, err
	}
	return results, nil
}

// resolveGroup keeps the provider's chosen group when the category allows it.
// Otherwise it prefers the group matching the transaction's direction, then
// the first membership, so a stored classification always carries a legal
// group when the category has any at all.
func resolveGroup(chosen string, allowed []string, isExpense bool) string {
	if len(allowed) == 0 {
		return ""
	}
	for _, key := range allowed {
		if key == chosen {
			return chosen
		}
	}

	preferred := "expenses"
	if !isExpense {
		preferred = "income"
	}
	for _, key := range allowed {
		if key == preferred {
			return preferred
		}
	}
	return allowed[0]
}

// ClassifyStored classifies stored statement rows, for callers that already
// have the rows (for example the HTTP API classifying a batch on request).
// Rows that already carry a classification should not be passed in; the
// caller is responsible for filtering them out so a human decision is never
// overwritten.
func (s *ClassificationsService) ClassifyStored(
	ctx context.Context,
	userID uuid.UUID,
	rows []postgres.StatementTransaction,
) ([]classifier.Result, error) {
	txns := make([]statements.Transaction, len(rows))
	for i, row := range rows {
		txns[i] = toStatementTransaction(row)
	}
	return s.Classify(ctx, userID, txns, rows)
}

// MarkSeen records that a human looked at a row's classification and returns
// the timestamp. Rows that have not been classified (or belong to somebody
// else) come back as sql.ErrNoRows.
func (s *ClassificationsService) MarkSeen(ctx context.Context, userID, transactionID uuid.UUID) (time.Time, error) {
	return s.store.Repos().Classifications.MarkSeen(ctx, userID, transactionID)
}

// SetCategoryInput is a human's category choice for a single stored row.
type SetCategoryInput struct {
	StatementTransactionID uuid.UUID
	CategoryID             uuid.UUID
	// IsExpense carries the expense decision. A nil value means the edit is
	// about the category only and the row is treated as an expense.
	IsExpense *bool
	// GroupKey is validated against the category's memberships; an empty or
	// illegal value falls back.
	GroupKey string
}

// SetCategory replaces one row's classification with a human decision without
// recording a correction. Table and details edits are about that single
// transaction, so the classifier's memory of the merchant is deliberately
// left alone: only a review confirms a row as the template for its
// description.
func (s *ClassificationsService) SetCategory(
	ctx context.Context,
	userID uuid.UUID,
	in SetCategoryInput,
) (postgres.StatementTransactionClassification, error) {
	var saved postgres.StatementTransactionClassification

	err := s.store.Do(ctx, func(repos *store.Repositories) error {
		txn, err := repos.Statements.GetByID(ctx, in.StatementTransactionID, userID)
		if err != nil {
			return fmt.Errorf("statement transaction: %w", err)
		}
		if _, err := repos.Categories.GetByID(ctx, in.CategoryID); err != nil {
			return fmt.Errorf("category: %w", err)
		}

		isExpense := true
		if in.IsExpense != nil {
			isExpense = *in.IsExpense
		}
		expenseProb := 1.0
		confidence := 1.0
		now := time.Now()

		// A category can sit in several groups, so validate the picked group
		// against the memberships and fall back when it is missing or illegal.
		allowed, err := repos.Categories.GroupKeys(ctx, in.CategoryID)
		if err != nil {
			return fmt.Errorf("category groups: %w", err)
		}

		saved, err = repos.Classifications.UpsertHuman(ctx, classifications.UpsertClassificationDTO{
			StatementTransactionID: txn.ID,
			CategoryID:             &in.CategoryID,
			IsExpense:              &isExpense,
			ExpenseProb:            &expenseProb,
			Confidence:             &confidence,
			Source:                 classifications.SourceHuman,
			GroupKey:               resolveGroup(in.GroupKey, allowed, isExpense),
			ClassifiedAt:           &now,
		})
		if err != nil {
			return fmt.Errorf("save human classification: %w", err)
		}
		return nil
	})
	if err != nil {
		return postgres.StatementTransactionClassification{}, err
	}
	return saved, nil
}

// toStatementTransaction rebuilds the parser's view of a stored row so the
// classifier can run over rows loaded from the database.
func toStatementTransaction(row postgres.StatementTransaction) statements.Transaction {
	moneyIn, _ := strconv.ParseFloat(row.MoneyIn, 64)
	moneyOut, _ := strconv.ParseFloat(row.MoneyOut, 64)
	fee, _ := strconv.ParseFloat(row.Fee, 64)

	balance := 0.0
	if row.Balance.Valid {
		balance, _ = strconv.ParseFloat(row.Balance.String, 64)
	}

	return statements.Transaction{
		Nr:                  int(row.Nr),
		Account:             row.Account,
		PostingDate:         row.PostingDate,
		TransactionDate:     row.TransactionDate,
		Description:         row.Description,
		OriginalDescription: row.OriginalDescription,
		ParentCategory:      stringValue(row.ParentCategory),
		Category:            stringValue(row.Category),
		MoneyIn:             moneyIn,
		MoneyOut:            moneyOut,
		Fee:                 fee,
		Balance:             balance,
	}
}

func stringValue(s sql.NullString) string {
	if !s.Valid {
		return ""
	}
	return s.String
}

// categories returns the active categories indexed by key and by id.
func (s *ClassificationsService) categories(ctx context.Context) (map[string]postgres.Category, map[uuid.UUID]postgres.Category, error) {
	active, err := s.store.Repos().Categories.ListActive(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("load categories: %w", err)
	}

	byKey := make(map[string]postgres.Category, len(active))
	byID := make(map[uuid.UUID]postgres.Category, len(active))
	for _, category := range active {
		byKey[category.Key] = category
		byID[category.ID] = category
	}
	return byKey, byID, nil
}

// knownCorrections rebuilds the classifier's memory of human decisions from
// the corrections table, translating the stored category ids back into the
// category keys the classifier answers with.
func (s *ClassificationsService) knownCorrections(ctx context.Context, userID uuid.UUID, byID map[uuid.UUID]postgres.Category) (corrections.Set, error) {
	stored, err := s.store.Repos().Corrections.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("load corrections: %w", err)
	}

	known := make(corrections.Set, len(stored))
	for _, correction := range stored {
		category, ok := byID[correction.CategoryID]
		if !ok {
			// The category was deleted; the correction no longer maps to
			// anything the classifier can answer with.
			continue
		}
		known[correction.NormalisedDescription] = category.Key
	}
	return known, nil
}

func (s *ClassificationsService) save(
	ctx context.Context,
	rows []postgres.StatementTransaction,
	results []classifier.Result,
	byKey map[string]postgres.Category,
) error {
	now := time.Now()

	return s.store.Do(ctx, func(repos *store.Repositories) error {
		for i, result := range results {
			if result.Err != nil {
				continue
			}

			var categoryID *uuid.UUID
			if category, ok := byKey[result.Category]; ok {
				id := category.ID
				categoryID = &id
			}

			isExpense := result.Expense >= 0.5
			expenseProb := result.Expense
			confidence := result.Confidence

			_, err := repos.Classifications.Upsert(ctx, classifications.UpsertClassificationDTO{
				StatementTransactionID: rows[i].ID,
				CategoryID:             categoryID,
				IsExpense:              &isExpense,
				ExpenseProb:            &expenseProb,
				Confidence:             &confidence,
				Source:                 string(result.Source),
				GroupKey:               result.Group,
				ClassifiedAt:           &now,
			})
			if err != nil {
				return fmt.Errorf("save classification for row %d: %w", rows[i].Nr, err)
			}
		}
		return nil
	})
}
