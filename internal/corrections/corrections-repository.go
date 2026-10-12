package corrections

import (
	"context"

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

func (r *CorrectionsRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]postgres.Correction, error) {
	return r.queries.GetAllCorrectionsByUserId(ctx, userID)
}
