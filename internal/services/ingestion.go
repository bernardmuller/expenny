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

// StoreResult is a stored statement that has not been classified yet.
type StoreResult struct {
	Rows      []postgres.StatementTransaction
	RowErrors []error
}

func NewIngestionService(parser *statements.Parser, store *store.Store, classifications *ClassificationsService) *IngestionService {
	return &IngestionService{parser: parser, store: store, classifications: classifications}
}

// Ingest parses a statement CSV, stores every row it can, and then classifies
// the stored rows. Storage and classification are separate transactions: the
// statement is a faithful copy of the CSV even if the classifier is down, and
// re-ingesting the same file is safe because rows upsert on their dedup hash.
func (s *IngestionService) Ingest(ctx context.Context, userID uuid.UUID, r io.Reader) (IngestResult, error) {
	parsed, err := s.parseAndStore(ctx, userID, r)
	if err != nil {
		return IngestResult{}, err
	}

	results, err := s.classifications.Classify(ctx, userID, parsed.txns, parsed.rows)
	if err != nil {
		return IngestResult{Rows: parsed.rows, RowErrors: parsed.rowErrors, ClassifyError: err}, nil
	}

	classified := 0
	for _, result := range results {
		if result.Err != nil {
			parsed.rowErrors = append(parsed.rowErrors, fmt.Errorf("row %d: %w", result.Transaction.Nr, result.Err))
			continue
		}
		classified++
	}

	return IngestResult{Rows: parsed.rows, Classified: classified, RowErrors: parsed.rowErrors}, nil
}

// Store parses a statement CSV and stores every row it can without
// classifying anything. The caller can classify the returned rows separately,
// which lets an HTTP client drive classification in batches and observe
// progress between them.
func (s *IngestionService) Store(ctx context.Context, userID uuid.UUID, r io.Reader) (StoreResult, error) {
	parsed, err := s.parseAndStore(ctx, userID, r)
	if err != nil {
		return StoreResult{}, err
	}
	return StoreResult{Rows: parsed.rows, RowErrors: parsed.rowErrors}, nil
}

type parsedStatement struct {
	txns      []statements.Transaction
	rows      []postgres.StatementTransaction
	rowErrors []error
}

func (s *IngestionService) parseAndStore(ctx context.Context, userID uuid.UUID, r io.Reader) (parsedStatement, error) {
	txns, rowErrs, err := s.parser.Parse(r)
	if err != nil {
		return parsedStatement{}, err
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
		return parsedStatement{}, err
	}

	return parsedStatement{txns: txns, rows: rows, rowErrors: rowErrs}, nil
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
