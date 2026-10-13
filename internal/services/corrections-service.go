package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/classifications"
	"expenny.co.za/internal/corrections"
	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
)

// CorrectionsService records a human's category decision for a statement row
// so the classifier can lean on it for future rows from the same merchant.
type CorrectionsService struct {
	store *store.Store
}

func NewCorrectionsService(st *store.Store) *CorrectionsService {
	return &CorrectionsService{store: st}
}

type CorrectionInput struct {
	StatementTransactionID uuid.UUID
	CategoryID             uuid.UUID
	// IsExpense carries the "not an expense" decision. A nil value means the
	// correction is about the category only.
	IsExpense *bool
}

// Save stores the correction against the row's normalised description and
// marks the row's classification as human, so neither a later re-ingest nor a
// classifier run can overwrite the decision. Both writes happen together with
// the ownership check.
func (s *CorrectionsService) Save(ctx context.Context, userID uuid.UUID, in CorrectionInput) (postgres.Correction, error) {
	var saved postgres.Correction

	err := s.store.Do(ctx, func(repos *store.Repositories) error {
		txn, err := repos.Statements.GetByID(ctx, in.StatementTransactionID, userID)
		if err != nil {
			return fmt.Errorf("statement transaction: %w", err)
		}

		if _, err := repos.Categories.GetByID(ctx, in.CategoryID); err != nil {
			return fmt.Errorf("category: %w", err)
		}

		saved, err = repos.Corrections.Upsert(ctx, userID, corrections.UpsertCorrectionDTO{
			NormalisedDescription: corrections.Normalise(strings.TrimSpace(txn.Description)),
			CategoryID:            in.CategoryID,
		})
		if err != nil {
			return fmt.Errorf("save correction: %w", err)
		}

		isExpense := true
		if in.IsExpense != nil {
			isExpense = *in.IsExpense
		}
		expenseProb := 1.0
		confidence := 1.0
		now := time.Now()

		_, err = repos.Classifications.UpsertHuman(ctx, classifications.UpsertClassificationDTO{
			StatementTransactionID: txn.ID,
			CategoryID:             &in.CategoryID,
			IsExpense:              &isExpense,
			ExpenseProb:            &expenseProb,
			Confidence:             &confidence,
			Source:                 classifications.SourceHuman,
			ClassifiedAt:           &now,
		})
		if err != nil {
			return fmt.Errorf("save human classification: %w", err)
		}
		return nil
	})
	if err != nil {
		return postgres.Correction{}, err
	}
	return saved, nil
}
