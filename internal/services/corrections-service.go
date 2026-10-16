package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/categories"
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

var (
	// ErrCorrectionDescriptionRequired is returned when a correction would be
	// saved with nothing to match on.
	ErrCorrectionDescriptionRequired = errors.New("correction description is required")
	// ErrCorrectionExists guards the unique (user, description) pair when a
	// description is created twice or renamed onto another entry.
	ErrCorrectionExists = errors.New("a correction for that description already exists")
)

// CorrectionWriteInput is a correction typed into the admin list rather than
// one captured from a statement row.
type CorrectionWriteInput struct {
	Description string
	CategoryID  uuid.UUID
}

// List returns every correction the user has, newest wording first, with the
// category each one maps to.
func (s *CorrectionsService) List(ctx context.Context, userID uuid.UUID) ([]corrections.CorrectionListItem, error) {
	items, err := s.store.Repos().Corrections.ListWithCategory(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list corrections: %w", err)
	}
	return items, nil
}

// Create stores a correction for a description the user typed. The wording is
// normalised exactly like a statement row's, so it matches future rows from
// the same merchant.
func (s *CorrectionsService) Create(ctx context.Context, userID uuid.UUID, in CorrectionWriteInput) (postgres.Correction, error) {
	description := corrections.Normalise(strings.TrimSpace(in.Description))
	if description == "" {
		return postgres.Correction{}, ErrCorrectionDescriptionRequired
	}

	var saved postgres.Correction
	err := s.store.Do(ctx, func(repos *store.Repositories) error {
		if _, err := repos.Categories.GetByID(ctx, in.CategoryID); err != nil {
			return fmt.Errorf("category: %w", err)
		}

		_, err := repos.Corrections.GetByDescription(ctx, userID, description)
		switch {
		case err == nil:
			return ErrCorrectionExists
		case !errors.Is(err, sql.ErrNoRows):
			return fmt.Errorf("check correction: %w", err)
		}

		saved, err = repos.Corrections.Upsert(ctx, userID, corrections.UpsertCorrectionDTO{
			NormalisedDescription: description,
			CategoryID:            in.CategoryID,
		})
		if err != nil {
			return fmt.Errorf("save correction: %w", err)
		}
		return nil
	})
	if err != nil {
		return postgres.Correction{}, err
	}
	return saved, nil
}

// Update rewrites one correction's wording and/or category.
func (s *CorrectionsService) Update(ctx context.Context, userID, id uuid.UUID, in CorrectionWriteInput) (postgres.Correction, error) {
	description := corrections.Normalise(strings.TrimSpace(in.Description))
	if description == "" {
		return postgres.Correction{}, ErrCorrectionDescriptionRequired
	}

	var saved postgres.Correction
	err := s.store.Do(ctx, func(repos *store.Repositories) error {
		if _, err := repos.Categories.GetByID(ctx, in.CategoryID); err != nil {
			return fmt.Errorf("category: %w", err)
		}

		var err error
		saved, err = repos.Corrections.Update(ctx, userID, id, corrections.UpsertCorrectionDTO{
			NormalisedDescription: description,
			CategoryID:            in.CategoryID,
		})
		if err != nil {
			if categories.IsUniqueViolation(err) {
				return ErrCorrectionExists
			}
			return fmt.Errorf("update correction: %w", err)
		}
		return nil
	})
	if err != nil {
		return postgres.Correction{}, err
	}
	return saved, nil
}

// Delete removes one correction so the classifier stops applying it.
func (s *CorrectionsService) Delete(ctx context.Context, userID, id uuid.UUID) error {
	if err := s.store.Repos().Corrections.Delete(ctx, userID, id); err != nil {
		return fmt.Errorf("delete correction: %w", err)
	}
	return nil
}

type CorrectionInput struct {
	StatementTransactionID uuid.UUID
	CategoryID             uuid.UUID
	// IsExpense carries the "not an expense" decision. A nil value means the
	// correction is about the category only.
	IsExpense *bool
	// GroupKey is the group the human picked. It is validated against the
	// category's memberships; an empty or illegal value falls back.
	GroupKey string
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

		// A category can sit in several groups, so a correction carries the
		// group the human picked and it is validated against the category's
		// memberships. resolveGroup falls back when it is missing or illegal.
		allowed, err := repos.Categories.GroupKeys(ctx, in.CategoryID)
		if err != nil {
			return fmt.Errorf("category groups: %w", err)
		}
		groupKey := resolveGroup(in.GroupKey, allowed, isExpense)

		_, err = repos.Classifications.UpsertHuman(ctx, classifications.UpsertClassificationDTO{
			StatementTransactionID: txn.ID,
			CategoryID:             &in.CategoryID,
			IsExpense:              &isExpense,
			ExpenseProb:            &expenseProb,
			Confidence:             &confidence,
			Source:                 classifications.SourceHuman,
			GroupKey:               groupKey,
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
