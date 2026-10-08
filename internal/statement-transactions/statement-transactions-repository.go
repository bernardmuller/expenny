package statementtransactions

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/store/postgres"
	"expenny.co.za/internal/store/utils"
)

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
	write(account)
	write(t.TransactionDate.UTC().Format(time.RFC3339))
	write(strconv.FormatFloat(t.MoneyIn, 'f', 2, 64))
	write(strconv.FormatFloat(t.MoneyOut, 'f', 2, 64))
	write(strconv.FormatFloat(t.Fee, 'f', 2, 64))
	write(strings.TrimSpace(t.OriginalDescription))
	return hex.EncodeToString(h.Sum(nil))
}

type StatementTransactionsRepository struct {
	Queries *postgres.Queries
}

func (r StatementTransactionsRepository) Create(ctx context.Context, dto CreateStatementTransactionDTO, userID uuid.UUID) (postgres.StatementTransaction, error) {
	return r.Queries.UpsertStatementTransaction(ctx, postgres.UpsertStatementTransactionParams{
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
