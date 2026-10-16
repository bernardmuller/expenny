package services

import (
	"context"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"expenny.co.za/internal/corrections"
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

		// A card payment first arrives tagged "(Pending)" and clears with the
		// tag gone. The cleared row replaces the pending one, so drop the stale
		// copy instead of showing the payment twice. Collided rows are the ones
		// the upsert reused for the cleared copy, so they are never deleted.
		removed, err := dropSupersededPending(ctx, repos, userID, txns, collidedPendingRows(txns, rows))
		if err != nil {
			return err
		}
		if len(removed) > 0 {
			// Ingest classifies txns and rows by index, so both shrink together.
			keptRows := make([]postgres.StatementTransaction, 0, len(rows))
			keptTxns := make([]statements.Transaction, 0, len(txns))
			for i, row := range rows {
				if removed[row.ID] {
					continue
				}
				keptRows = append(keptRows, row)
				keptTxns = append(keptTxns, txns[i])
			}
			rows, txns = keptRows, keptTxns
		}
		return nil
	})
	if err != nil {
		return parsedStatement{}, err
	}

	return parsedStatement{txns: txns, rows: rows, rowErrors: rowErrs}, nil
}

const pendingTag = "(pending)"

// isPendingDescription reports whether the bank tagged a description as not
// yet cleared. Capitec puts the tag in front; some exports append it.
func isPendingDescription(description string) bool {
	trimmed := strings.ToLower(strings.TrimSpace(description))
	return strings.HasPrefix(trimmed, pendingTag) || strings.HasSuffix(trimmed, pendingTag)
}

// descriptionWithoutPendingTag drops the tag so a pending row's merchant can
// be compared with the cleared row's description.
func descriptionWithoutPendingTag(description string) string {
	trimmed := strings.TrimSpace(description)
	lower := strings.ToLower(trimmed)
	switch {
	case strings.HasPrefix(lower, pendingTag):
		return strings.TrimSpace(trimmed[len(pendingTag):])
	case strings.HasSuffix(lower, pendingTag):
		return strings.TrimSpace(trimmed[:len(trimmed)-len(pendingTag)])
	default:
		return trimmed
	}
}

// collidedPendingRows finds upserted rows that still carry the pending tag
// even though the incoming copy was cleared. The dedup hash matched an
// existing pending row, so that row is the same stored transaction and
// deleting it would lose the cleared copy.
func collidedPendingRows(txns []statements.Transaction, rows []postgres.StatementTransaction) map[uuid.UUID]bool {
	collided := make(map[uuid.UUID]bool)
	for i, t := range txns {
		if i >= len(rows) {
			break
		}
		if !isPendingDescription(t.Description) && isPendingDescription(rows[i].Description) {
			collided[rows[i].ID] = true
		}
	}
	return collided
}

// dropSupersededPending deletes stored rows that are still tagged "(Pending)"
// once a cleared copy of the same payment arrives: same account, same amounts
// and the same merchant name without the tag. It returns the deleted ids so
// the caller can leave them out of the rows it hands to the classifier.
func dropSupersededPending(
	ctx context.Context,
	repos *store.Repositories,
	userID uuid.UUID,
	txns []statements.Transaction,
	protected map[uuid.UUID]bool,
) (map[uuid.UUID]bool, error) {
	cleared := make([]statements.Transaction, 0, len(txns))
	for _, t := range txns {
		if !isPendingDescription(t.Description) {
			cleared = append(cleared, t)
		}
	}
	if len(cleared) == 0 {
		return nil, nil
	}

	stored, err := repos.Statements.ListPendingByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list pending transactions: %w", err)
	}

	removed := make(map[uuid.UUID]bool)
	ids := make([]uuid.UUID, 0, len(stored))
	for _, row := range stored {
		if protected[row.ID] || !isPendingDescription(row.Description) {
			continue
		}
		for _, t := range cleared {
			if clearsPending(t, row) {
				removed[row.ID] = true
				ids = append(ids, row.ID)
				break
			}
		}
	}
	if len(ids) == 0 {
		return nil, nil
	}

	if err := repos.Statements.DeleteByIDs(ctx, userID, ids); err != nil {
		return nil, fmt.Errorf("delete superseded pending transactions: %w", err)
	}
	return removed, nil
}

// clearsPending reports whether a cleared row is the same payment as a stored
// pending row.
func clearsPending(cleared statements.Transaction, pending postgres.StatementTransaction) bool {
	if cleared.Account != pending.Account {
		return false
	}
	if formatMoney(cleared.MoneyIn) != pending.MoneyIn ||
		formatMoney(cleared.MoneyOut) != pending.MoneyOut ||
		formatMoney(cleared.Fee) != pending.Fee {
		return false
	}
	return sameMerchantName(cleared.Description, pending.Description)
}

// sameMerchantName compares two descriptions ignoring a "(Pending)" tag, the
// card number and reference numbers, so a pending row and its cleared copy
// match even when the bank reworded them.
func sameMerchantName(a, b string) bool {
	a = descriptionWithoutPendingTag(a)
	b = descriptionWithoutPendingTag(b)
	if strings.EqualFold(a, b) {
		return true
	}

	keyA := corrections.Normalise(a)
	keyB := corrections.Normalise(b)
	if keyA == "" || keyB == "" {
		return false
	}
	if keyA == keyB {
		return true
	}
	// The cleared copy can carry a transaction-type prefix the pending copy
	// does not, as in "Online Purchase: Steam Games Bellevue".
	return strings.HasSuffix(keyA, " "+keyB) || strings.HasSuffix(keyB, " "+keyA)
}

func formatMoney(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64)
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
