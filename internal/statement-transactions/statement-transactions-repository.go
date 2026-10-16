package statementtransactions

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/store/utils"
)

type ClassifiedListFilter struct {
	Limit       int
	Offset      int
	CategoryID  *uuid.UUID
	WindowStart *time.Time
	WindowEnd   *time.Time
}

type CreateStatementTransactionDTO struct {
	Account             string
	Nr                  int32
	PostingDate         time.Time
	TransactionDate     time.Time
	Description         string
	OriginalDescription string
	ParentCategory      *string
	Category            *string
	MoneyIn             float64
	MoneyOut            float64
	Fee                 float64
	Balance             *float64
}

func DedupHash(account string, t CreateStatementTransactionDTO) string {
	h := sha256.New()
	write := func(s string) { fmt.Fprintf(h, "%d:%s|", len(s), s) }
	write(t.Account)
	write(t.TransactionDate.UTC().Format(time.RFC3339))
	write(strconv.FormatFloat(t.MoneyIn, 'f', 2, 64))
	write(strconv.FormatFloat(t.MoneyOut, 'f', 2, 64))
	write(strconv.FormatFloat(t.Fee, 'f', 2, 64))
	write(strings.TrimSpace(t.OriginalDescription))
	return hex.EncodeToString(h.Sum(nil))
}

type StatementTransactionsRepository struct {
	DB *postgres.Queries
}

func NewStatementTransactionRepository(db *postgres.Queries) *StatementTransactionsRepository {
	return &StatementTransactionsRepository{DB: db}
}

func (r *StatementTransactionsRepository) GetByID(ctx context.Context, id, userID uuid.UUID) (postgres.StatementTransaction, error) {
	return r.DB.GetStatementTransactionById(ctx, postgres.GetStatementTransactionByIdParams{
		ID:     id,
		UserID: userID,
	})
}

// ListClassifiedByUser returns a page of statement rows for the user
// together with their classification and category. Rows that were never
// classified are still returned, with the classification and category fields
// left NULL. The filter can narrow the page to one category and/or a date
// window.
func (r *StatementTransactionsRepository) ListClassifiedByUser(ctx context.Context, userID uuid.UUID, filter ClassifiedListFilter) ([]postgres.GetClassifiedStatementTransactionsByUserIdPageRow, error) {
	return r.DB.GetClassifiedStatementTransactionsByUserIdPage(ctx, postgres.GetClassifiedStatementTransactionsByUserIdPageParams{
		UserID:      userID,
		CategoryID:  utils.NullUUID(filter.CategoryID),
		WindowStart: utils.NullTime(filter.WindowStart),
		WindowEnd:   utils.NullTime(filter.WindowEnd),
		PageLimit:   int32(filter.Limit),
		PageOffset:  int32(filter.Offset),
	})
}

// CountByUser returns the total number of statement rows for the user.
func (r *StatementTransactionsRepository) CountByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	return r.DB.CountStatementTransactionsByUser(ctx, userID)
}

// CountNeedingReview returns how many rows still need a human decision, using
// the same confidence threshold the API applies when serialising rows.
func (r *StatementTransactionsRepository) CountNeedingReview(ctx context.Context, userID uuid.UUID, threshold float64) (int64, error) {
	return r.DB.CountStatementTransactionsNeedingReview(ctx, postgres.CountStatementTransactionsNeedingReviewParams{
		UserID:    userID,
		Threshold: threshold,
	})
}

// ListUnclassifiedByIDs returns the rows the user owns that are in the given
// id set and do not have a classification yet. Rows that are missing, owned
// by somebody else, or already classified are simply omitted.
func (r *StatementTransactionsRepository) ListUnclassifiedByIDs(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) ([]postgres.StatementTransaction, error) {
	return r.DB.GetUnclassifiedStatementTransactionsByIds(ctx, postgres.GetUnclassifiedStatementTransactionsByIdsParams{
		UserID: userID,
		Ids:    ids,
	})
}

// ListUnclassifiedByUser returns up to limit of the user's rows that do not
// have a classification yet, oldest first. It lets a client resume an
// interrupted import without knowing the row ids in advance.
func (r *StatementTransactionsRepository) ListUnclassifiedByUser(ctx context.Context, userID uuid.UUID, limit int) ([]postgres.StatementTransaction, error) {
	return r.DB.GetUnclassifiedStatementTransactionsByUser(ctx, postgres.GetUnclassifiedStatementTransactionsByUserParams{
		UserID:    userID,
		PageLimit: int32(limit),
	})
}

// CountUnclassifiedByUser returns how many of the user's rows still need a
// classification.
func (r *StatementTransactionsRepository) CountUnclassifiedByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	return r.DB.CountUnclassifiedStatementTransactionsByUser(ctx, userID)
}

// ListPendingByUser returns the user's rows whose description carries the
// "(Pending)" tag. The exact tag check is repeated in Go because the bank
// decides the casing and position.
func (r *StatementTransactionsRepository) ListPendingByUser(ctx context.Context, userID uuid.UUID) ([]postgres.StatementTransaction, error) {
	return r.DB.GetPendingStatementTransactionsByUser(ctx, userID)
}

// DeleteByIDs removes rows the user owns. Their classifications and any
// derived transactions go with them through the foreign keys.
func (r *StatementTransactionsRepository) DeleteByIDs(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) error {
	return r.DB.DeleteStatementTransactionsByIDs(ctx, postgres.DeleteStatementTransactionsByIDsParams{
		UserID: userID,
		Ids:    ids,
	})
}

// LatestBalance returns the balance of the most recent statement row that has
// one. An empty account means every account. It returns sql.ErrNoRows when no
// row carries a balance yet.
func (r *StatementTransactionsRepository) LatestBalance(ctx context.Context, userID uuid.UUID, account string) (string, error) {
	balance, err := r.DB.GetLatestStatementBalance(ctx, postgres.GetLatestStatementBalanceParams{
		UserID:  userID,
		Account: account,
	})
	if err != nil {
		return "", err
	}
	if !balance.Valid {
		return "", sql.ErrNoRows
	}
	return balance.String, nil
}

// LatestSalary returns the most recent row inside the window that is either
// categorised as salary or carries the income group. endExclusive is the day
// after the window's last day.
func (r *StatementTransactionsRepository) LatestSalary(ctx context.Context, userID uuid.UUID, start, endExclusive time.Time, account string) (postgres.GetLatestSalaryTransactionRow, error) {
	return r.DB.GetLatestSalaryTransaction(ctx, postgres.GetLatestSalaryTransactionParams{
		UserID:       userID,
		StartDate:    start,
		EndExclusive: endExclusive,
		Account:      account,
	})
}

// ListAccounts returns the distinct statement account numbers the user has
// imported, for scoping the budget window to one account.
func (r *StatementTransactionsRepository) ListAccounts(ctx context.Context, userID uuid.UUID) ([]string, error) {
	return r.DB.ListStatementAccounts(ctx, userID)
}

func (r *StatementTransactionsRepository) Create(ctx context.Context, dto CreateStatementTransactionDTO, userID uuid.UUID) (postgres.StatementTransaction, error) {
	return r.DB.UpsertStatementTransaction(ctx, postgres.UpsertStatementTransactionParams{
		ID:                  uuid.New(),
		UserID:              userID,
		Account:             dto.Account,
		Nr:                  dto.Nr,
		PostingDate:         dto.PostingDate,
		TransactionDate:     dto.TransactionDate,
		Description:         dto.Description,
		OriginalDescription: dto.OriginalDescription,
		ParentCategory:      utils.NullString(dto.ParentCategory),
		Category:            utils.NullString(dto.Category),
		Balance:             utils.NullFloat(dto.Balance),
		MoneyIn:             strconv.FormatFloat(dto.MoneyIn, 'f', 2, 64),
		MoneyOut:            strconv.FormatFloat(dto.MoneyOut, 'f', 2, 64),
		Fee:                 strconv.FormatFloat(dto.Fee, 'f', 2, 64),
		DedupHash:           DedupHash(dto.Account, dto),
	})
}
