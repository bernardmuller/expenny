package services

import (
	"context"
	"io"

	"github.com/google/uuid"

	statementtransactions "expenny.co.za/internal/statement-transactions"
	"expenny.co.za/internal/statements"
	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/store/utils"
)

type IngestionService struct {
	parser *statements.Parser
	store  *store.Store
}

type IngestResult struct {
	Rows      []postgres.StatementTransaction
	RowErrors []error
}

func NewIngestionService(parser *statements.Parser, store *store.Store) *IngestionService {
	return &IngestionService{parser: parser, store: store}
}

func (s *IngestionService) Ingest(ctx context.Context, userID uuid.UUID, r io.Reader) (IngestResult, error) {
	txns, rowErrs, err := s.parser.Parse(r)
	if err != nil {
		return IngestResult{}, err
	}

	rows := make([]postgres.StatementTransaction, 0, len(txns))
	err = s.store.Do(ctx, func(repos *store.Repositories) error {
		for _, t := range txns {
			row, err := repos.Statements.Create(ctx, toStatementTransactionDTO(t), userID)
			if err != nil {
				return err
			}
			rows = append(rows, row)
		}
		return nil
	})
	if err != nil {
		return IngestResult{}, err
	}

	return IngestResult{Rows: rows, RowErrors: rowErrs}, nil
}

func toStatementTransactionDTO(t statements.Transaction) statementtransactions.CreateStatementTransactionDTO {
	return statementtransactions.CreateStatementTransactionDTO{
		Account:             t.Account,
		Nr:                  int32(t.Nr),
		PostingDate:         t.PostingDate,
		TransactionDate:     t.TransactionDate,
		Description:         t.Description,
		OriginalDescription: t.OriginalDescription,
		ParentCategory:      utils.OptionalString(t.ParentCategory),
		Category:            utils.OptionalString(t.Category),
		MoneyIn:             t.MoneyIn,
		MoneyOut:            t.MoneyOut,
		Fee:                 t.Fee,
		Balance:             utils.OptionalFloat(t.Balance),
	}
}
