package services

import (
	"context"
	"fmt"
	"io"

	"github.com/google/uuid"

	statementtransactions "expenny.co.za/internal/statement-transactions"
	"expenny.co.za/internal/statements"
	"expenny.co.za/internal/store"
	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/store/utils"
)

type IngestionService struct {
	parser          *statements.Parser
	store           *store.Store
	classifications *ClassificationsService
}

type IngestResult struct {
	Rows       []postgres.StatementTransaction
	Classified int
	RowErrors  []error
	// ClassifyError reports a failure that affected classification as a
	// whole (loading categories/corrections or saving the results). The
	// statement rows are still stored when it is set.
	ClassifyError error
}

func NewIngestionService(parser *statements.Parser, store *store.Store, classifications *ClassificationsService) *IngestionService {
	return &IngestionService{parser: parser, store: store, classifications: classifications}
}

// Ingest parses a statement CSV, stores every row it can, and then classifies
// the stored rows. Storage and classification are separate transactions: the
// statement is a faithful copy of the CSV even if the classifier is down, and
// re-ingesting the same file is safe because rows upsert on their dedup hash.
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

	results, err := s.classifications.Classify(ctx, userID, txns, rows)
	if err != nil {
		return IngestResult{Rows: rows, RowErrors: rowErrs, ClassifyError: err}, nil
	}

	classified := 0
	for _, result := range results {
		if result.Err != nil {
			rowErrs = append(rowErrs, fmt.Errorf("row %d: %w", result.Transaction.Nr, result.Err))
			continue
		}
		classified++
	}

	return IngestResult{Rows: rows, Classified: classified, RowErrors: rowErrs}, nil
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
