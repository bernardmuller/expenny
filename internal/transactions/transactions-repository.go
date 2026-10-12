package transactions

import (
	"context"
	"strconv"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/store/utils"
)

type CreateTransactionDTO struct {
	StatementTransactionID uuid.UUID
	CategoryID             *uuid.UUID
	Description            string
	Amount                 float64 // signed: negative = money out
	Note                   *string
}

type TransactionsRepository struct {
	queries *postgres.Queries
}

func NewTransactionsRepository(queries *postgres.Queries) *TransactionsRepository {
	return &TransactionsRepository{queries: queries}
}

func (r *TransactionsRepository) Create(ctx context.Context, userID uuid.UUID, dto CreateTransactionDTO) (postgres.Transaction, error) {
	return r.queries.UpsertTransaction(ctx, postgres.UpsertTransactionParams{
		ID:                     uuid.New(),
		UserID:                 userID,
		StatementTransactionID: dto.StatementTransactionID,
		CategoryID:             utils.NullUUID(dto.CategoryID),
		Description:            dto.Description,
		Amount:                 strconv.FormatFloat(dto.Amount, 'f', 2, 64),
		Note:                   utils.NullString(dto.Note),
	})
}

func (r *TransactionsRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]postgres.Transaction, error) {
	return r.queries.GetAllTransactionsByUserId(ctx, userID)
}
