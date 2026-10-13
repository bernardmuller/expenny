package services

import (
	"context"
	"fmt"
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

	known, err := s.knownCorrections(ctx, userID, byID)
	if err != nil {
		return nil, err
	}

	options := make(map[string]string, len(byKey))
	for key, category := range byKey {
		options[key] = category.Label
	}

	c := classifier.New(classifier.Config{
		Provider:   s.provider,
		Categories: options,
		Known:      known,
	})

	results := c.Classify(ctx, txns)

	if err := s.save(ctx, rows, results, byKey); err != nil {
		return results, err
	}
	return results, nil
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
				ClassifiedAt:           &now,
			})
			if err != nil {
				return fmt.Errorf("save classification for row %d: %w", rows[i].Nr, err)
			}
		}
		return nil
	})
}
