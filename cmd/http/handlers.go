package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/application"
	"expenny.co.za/internal/auth"
	"expenny.co.za/internal/classifications"
	"expenny.co.za/internal/services"
	"expenny.co.za/internal/store/postgres"
)

const maxStatementUpload = 10 << 20 // 10 MiB

type api struct {
	app *application.Application
}

func handleHello(w http.ResponseWriter, _ *http.Request) {
	_, _ = w.Write([]byte("hello from v2\n"))
}

type meResponse struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorBody("unauthorized"))
		return
	}

	writeJSON(w, http.StatusOK, meResponse{
		ID:    user.ID.String(),
		Name:  user.Name,
		Email: user.Email,
	})
}

type ingestResponse struct {
	Processed           int      `json:"processed"`
	Classified          int      `json:"classified"`
	Skipped             int      `json:"skipped"`
	Errors              []string `json:"errors,omitempty"`
	ClassificationError string   `json:"classification_error,omitempty"`
}

// ingestStatement accepts a multipart upload whose "file" part is the raw
// statement CSV. Rows are stored as-is first, then classified.
func (a *api) ingestStatement(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxStatementUpload)
	file, header, err := r.FormFile("file")
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeJSON(w, http.StatusRequestEntityTooLarge, errorBody("statement file is too large"))
			return
		}
		writeJSON(w, http.StatusBadRequest, errorBody(`multipart field "file" with the statement CSV is required`))
		return
	}
	defer file.Close()

	result, err := a.app.Ingestion.Ingest(r.Context(), user.ID, file)
	if err != nil {
		log.Printf("ingest %q: %v", header.Filename, err)
		writeJSON(w, http.StatusInternalServerError, errorBody("ingest failed"))
		return
	}

	body := ingestResponse{
		Processed:  len(result.Rows),
		Classified: result.Classified,
		Skipped:    len(result.RowErrors),
	}
	if result.ClassifyError != nil {
		log.Printf("classify %q: %v", header.Filename, result.ClassifyError)
		body.ClassificationError = result.ClassifyError.Error()
	}
	for _, rowErr := range result.RowErrors {
		body.Errors = append(body.Errors, rowErr.Error())
	}
	writeJSON(w, http.StatusOK, body)
}

type categoryResponse struct {
	ID    string `json:"id"`
	Key   string `json:"key"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
}

type classificationResponse struct {
	ID           string            `json:"id"`
	Category     *categoryResponse `json:"category"`
	IsExpense    *bool             `json:"is_expense"`
	ExpenseProb  *float64          `json:"expense_prob"`
	Confidence   *float64          `json:"confidence"`
	Source       string            `json:"source"`
	ClassifiedAt *time.Time        `json:"classified_at"`
}

type transactionResponse struct {
	ID                  string                  `json:"id"`
	Nr                  int32                   `json:"nr"`
	Account             string                  `json:"account"`
	PostingDate         time.Time               `json:"posting_date"`
	TransactionDate     time.Time               `json:"transaction_date"`
	Description         string                  `json:"description"`
	OriginalDescription string                  `json:"original_description"`
	ParentCategory      *string                 `json:"parent_category"`
	Category            *string                 `json:"category"`
	MoneyIn             string                  `json:"money_in"`
	MoneyOut            string                  `json:"money_out"`
	Fee                 string                  `json:"fee"`
	Balance             *string                 `json:"balance"`
	Classification      *classificationResponse `json:"classification"`
	NeedsReview         bool                    `json:"needs_review"`
}

type transactionListResponse struct {
	Transactions []transactionResponse `json:"transactions"`
}

type categoryListResponse struct {
	Categories []categoryResponse `json:"categories"`
}

// listTransactions returns every statement row joined with its classification
// and category, newest first. Rows the classifier could not process are
// included with a null classification and needs_review true.
func (a *api) listTransactions(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	rows, err := a.app.Review.ListTransactions(r.Context(), user.ID)
	if err != nil {
		log.Printf("list transactions: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load transactions"))
		return
	}

	writeJSON(w, http.StatusOK, transactionListResponse{Transactions: toTransactionResponses(rows)})
}

func (a *api) listCategories(w http.ResponseWriter, r *http.Request) {
	if _, ok := requestUser(w, r); !ok {
		return
	}

	categories, err := a.app.Review.ListCategories(r.Context())
	if err != nil {
		log.Printf("list categories: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load categories"))
		return
	}

	body := categoryListResponse{Categories: make([]categoryResponse, 0, len(categories))}
	for _, category := range categories {
		body.Categories = append(body.Categories, categoryResponse{
			ID:    category.ID.String(),
			Key:   category.Key,
			Label: category.Label,
			Icon:  category.Icon,
		})
	}
	writeJSON(w, http.StatusOK, body)
}

type correctionRequest struct {
	CategoryID uuid.UUID `json:"category_id"`
	IsExpense  *bool     `json:"is_expense"`
}

type correctionResponse struct {
	ID                    string `json:"id"`
	NormalisedDescription string `json:"normalised_description"`
	CategoryID            string `json:"category_id"`
}

// correctTransaction records a human decision for one statement row. The
// decision is kept in the corrections table, which feeds the classifier, and
// it replaces the row's classification so the row leaves the review queue.
func (a *api) correctTransaction(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	transactionID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("statement transaction id is not a uuid"))
		return
	}

	var req correctionRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return
	}
	if req.CategoryID == uuid.Nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category_id is required"))
		return
	}

	saved, err := a.app.Corrections.Save(r.Context(), user.ID, services.CorrectionInput{
		StatementTransactionID: transactionID,
		CategoryID:             req.CategoryID,
		IsExpense:              req.IsExpense,
	})
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, errorBody("statement transaction or category not found"))
		return
	}
	if err != nil {
		log.Printf("correct transaction %s: %v", transactionID, err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not save correction"))
		return
	}

	writeJSON(w, http.StatusOK, correctionResponse{
		ID:                    saved.ID.String(),
		NormalisedDescription: saved.NormalisedDescription,
		CategoryID:            saved.CategoryID.String(),
	})
}

func requestUser(w http.ResponseWriter, r *http.Request) (postgres.User, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorBody("unauthorized"))
		return postgres.User{}, false
	}
	return user, true
}

func errorBody(message string) map[string]string {
	return map[string]string{"error": message}
}

func toTransactionResponses(rows []postgres.GetClassifiedStatementTransactionsByUserIdRow) []transactionResponse {
	out := make([]transactionResponse, 0, len(rows))
	for _, row := range rows {
		txn := transactionResponse{
			ID:                  row.ID.String(),
			Nr:                  row.Nr,
			Account:             row.Account,
			PostingDate:         row.PostingDate,
			TransactionDate:     row.TransactionDate,
			Description:         row.Description,
			OriginalDescription: row.OriginalDescription,
			ParentCategory:      nullableString(row.ParentCategory),
			Category:            nullableString(row.Category),
			MoneyIn:             row.MoneyIn,
			MoneyOut:            row.MoneyOut,
			Fee:                 row.Fee,
			Balance:             nullableString(row.Balance),
			NeedsReview:         true,
		}

		if row.ClassificationID.Valid {
			txn.Classification = &classificationResponse{
				ID:           row.ClassificationID.UUID.String(),
				IsExpense:    nullableBool(row.IsExpense),
				Source:       row.Source.String,
				Confidence:   nullableRatio(row.Confidence),
				ExpenseProb:  nullableRatio(row.ExpenseProb),
				ClassifiedAt: nullableTime(row.ClassifiedAt),
			}
			if row.CategoryID.Valid {
				txn.Classification.Category = &categoryResponse{
					ID:    row.CategoryID.UUID.String(),
					Key:   row.CategoryKey.String,
					Label: row.CategoryLabel.String,
					Icon:  row.CategoryIcon.String,
				}
			}
			txn.NeedsReview = needsReview(row)
		}

		out = append(out, txn)
	}
	return out
}

// needsReview reports whether a classified row still needs a human. A human
// decision never does; everything else does until it clears the threshold.
func needsReview(row postgres.GetClassifiedStatementTransactionsByUserIdRow) bool {
	if row.Source.String == classifications.SourceHuman {
		return false
	}
	confidence := nullableRatio(row.Confidence)
	if confidence == nil {
		return true
	}
	return *confidence < services.NeedsReviewThreshold
}

func nullableString(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	return &s.String
}

func nullableBool(b sql.NullBool) *bool {
	if !b.Valid {
		return nil
	}
	return &b.Bool
}

func nullableTime(t sql.NullTime) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

func nullableRatio(s sql.NullString) *float64 {
	if !s.Valid {
		return nil
	}
	v, err := strconv.ParseFloat(s.String, 64)
	if err != nil {
		return nil
	}
	return &v
}
