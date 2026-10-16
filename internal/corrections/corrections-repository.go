package corrections

import (
	"context"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
)

type UpsertCorrectionDTO struct {
	NormalisedDescription string
	CategoryID            uuid.UUID
}

type CorrectionsRepository struct {
	queries *postgres.Queries
}

func NewCorrectionsRepository(queries *postgres.Queries) *CorrectionsRepository {
	return &CorrectionsRepository{queries: queries}
}

func (r *CorrectionsRepository) Upsert(ctx context.Context, userID uuid.UUID, dto UpsertCorrectionDTO) (postgres.Correction, error) {
	return r.queries.UpsertCorrection(ctx, postgres.UpsertCorrectionParams{
		ID:                    uuid.New(),
		UserID:                userID,
		NormalisedDescription: dto.NormalisedDescription,
		CategoryID:            dto.CategoryID,
	})
}

type CorrectionListItem struct {
	ID                    uuid.UUID
	NormalisedDescription string
	CategoryID            uuid.UUID
	CategoryKey           string
	CategoryLabel         string
	CategoryIcon          string
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

// GetByDescription looks a correction up the way the classifier does, by the
// normalised merchant wording.
func (r *CorrectionsRepository) GetByDescription(ctx context.Context, userID uuid.UUID, description string) (postgres.Correction, error) {
	return r.queries.GetCorrectionByDescription(ctx, postgres.GetCorrectionByDescriptionParams{
		UserID:                userID,
		NormalisedDescription: description,
	})
}

// Update rewrites one correction. The unique (user_id, description) index
// rejects a description that already belongs to another entry.
func (r *CorrectionsRepository) Update(ctx context.Context, userID, id uuid.UUID, dto UpsertCorrectionDTO) (postgres.Correction, error) {
	return r.queries.UpdateCorrection(ctx, postgres.UpdateCorrectionParams{
		ID:                    id,
		UserID:                userID,
		NormalisedDescription: dto.NormalisedDescription,
		CategoryID:            dto.CategoryID,
	})
}

func (r *CorrectionsRepository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return r.queries.DeleteCorrection(ctx, postgres.DeleteCorrectionParams{
		ID:     id,
		UserID: userID,
	})
}

func (r *CorrectionsRepository) ListWithCategory(ctx context.Context, userID uuid.UUID) ([]CorrectionListItem, error) {
	rows, err := r.queries.GetCorrectionsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	items := make([]CorrectionListItem, len(rows))
	for i, row := range rows {
		items[i] = CorrectionListItem{
			ID:                    row.ID,
			NormalisedDescription: row.NormalisedDescription,
			CategoryID:            row.CategoryID,
			CategoryKey:           row.CategoryKey,
			CategoryLabel:         row.CategoryLabel,
			CategoryIcon:          row.CategoryIcon,
			CreatedAt:             row.CreatedAt,
			UpdatedAt:             row.UpdatedAt,
		}
	}
	return items, nil
}

func (r *CorrectionsRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]postgres.Correction, error) {
	return r.queries.GetAllCorrectionsByUserId(ctx, userID)
}
