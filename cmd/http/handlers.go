package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"expenny.co.za/internal/application"
	"expenny.co.za/internal/auth"
	"expenny.co.za/internal/classifications"
	"expenny.co.za/internal/classifier"
	"expenny.co.za/internal/services"
	"expenny.co.za/internal/store/postgres"
)

const maxStatementUpload = 10 << 20 // 10 MiB

// maxClassifyBatch caps one classification request. The web client sends one
// transaction per request so it can report per-transaction progress, but the
// endpoint accepts small batches to keep request counts down.
const maxClassifyBatch = 20

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
	Processed      int      `json:"processed"`
	Skipped        int      `json:"skipped"`
	TransactionIDs []string `json:"transaction_ids"`
	Errors         []string `json:"errors,omitempty"`
}

// ingestStatement accepts a statement CSV, stores every row, and returns the
// stored row ids. Classification is deliberately left out: the client asks
// /v2/statements/classify to classify the ids in small batches, which gives it
// per-transaction progress without relying on a streaming response.
//
// The CSV can arrive as a multipart upload with a "file" part, as a JSON body
// of the form {"csv": "..."}, or as a raw text/csv body (a pasted statement).
func (a *api) ingestStatement(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxStatementUpload)

	var (
		reader io.Reader = r.Body
		label            = "statement.csv"
	)

	switch {
	case strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data"):
		file, header, err := r.FormFile("file")
		if err != nil {
			if isMaxBytes(err) {
				writeJSON(w, http.StatusRequestEntityTooLarge, errorBody("statement file is too large"))
				return
			}
			writeJSON(w, http.StatusBadRequest, errorBody(`multipart field "file" with the statement CSV is required`))
			return
		}
		defer file.Close()
		reader = file
		label = header.Filename

	case strings.HasPrefix(r.Header.Get("Content-Type"), "application/json"):
		var req struct {
			CSV string `json:"csv"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			if isMaxBytes(err) {
				writeJSON(w, http.StatusRequestEntityTooLarge, errorBody("statement is too large"))
				return
			}
			writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
			return
		}
		if strings.TrimSpace(req.CSV) == "" {
			writeJSON(w, http.StatusBadRequest, errorBody(`"csv" must contain the statement text`))
			return
		}
		reader = strings.NewReader(req.CSV)
		label = "pasted.csv"
	}

	result, err := a.app.Ingestion.Store(r.Context(), user.ID, reader)
	if err != nil {
		log.Printf("ingest %q: %v", label, err)
		writeJSON(w, http.StatusInternalServerError, errorBody("ingest failed"))
		return
	}

	body := ingestResponse{
		Processed:      len(result.Rows),
		Skipped:        len(result.RowErrors),
		TransactionIDs: make([]string, 0, len(result.Rows)),
	}
	for _, row := range result.Rows {
		body.TransactionIDs = append(body.TransactionIDs, row.ID.String())
	}
	for _, rowErr := range result.RowErrors {
		body.Errors = append(body.Errors, rowErr.Error())
	}
	writeJSON(w, http.StatusOK, body)
}

type categoryGroupResponse struct {
	ID    string `json:"id"`
	Key   string `json:"key"`
	Label string `json:"label"`
}

type categoryResponse struct {
	ID     string                  `json:"id"`
	Key    string                  `json:"key"`
	Label  string                  `json:"label"`
	Icon   string                  `json:"icon"`
	Groups []categoryGroupResponse `json:"groups"`
}

type classificationResponse struct {
	ID           string            `json:"id"`
	Category     *categoryResponse `json:"category"`
	IsExpense    *bool             `json:"is_expense"`
	ExpenseProb  *float64          `json:"expense_prob"`
	Confidence   *float64          `json:"confidence"`
	Source       string            `json:"source"`
	Group        *string           `json:"group"`
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
	Total        int                   `json:"total"`
	ReviewCount  int                   `json:"review_count"`
	NextOffset   *int                  `json:"next_offset"`
}

type categoryListResponse struct {
	Categories []categoryResponse `json:"categories"`
}

// listTransactions returns a page of statement rows joined with their
// classification and category, newest first. Rows the classifier could not
// process are included with a null classification and needs_review true. The
// response carries the totals for the whole statement so clients can show
// counters that span every page.
func (a *api) listTransactions(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	query := r.URL.Query()
	limit := clampedInt(query.Get("limit"), services.DefaultTransactionPageSize, 1, services.MaxTransactionPageSize)
	offset := clampedInt(query.Get("offset"), 0, 0, 1<<31-1)

	page, err := a.app.Review.ListTransactions(r.Context(), user.ID, limit, offset)
	if err != nil {
		log.Printf("list transactions: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load transactions"))
		return
	}

	transactions := toTransactionResponses(page.Rows)
	var nextOffset *int
	if len(transactions) > 0 && offset+len(transactions) < page.Total {
		next := offset + len(transactions)
		nextOffset = &next
	}

	writeJSON(w, http.StatusOK, transactionListResponse{
		Transactions: transactions,
		Total:        page.Total,
		ReviewCount:  page.ReviewCount,
		NextOffset:   nextOffset,
	})
}

type classifyRequest struct {
	TransactionIDs []uuid.UUID `json:"transaction_ids"`
}

type classifiedTransactionResponse struct {
	ID                  string            `json:"id"`
	Description         string            `json:"description"`
	OriginalDescription string            `json:"original_description"`
	TransactionDate     time.Time         `json:"transaction_date"`
	Category            *categoryResponse `json:"category"`
	IsExpense           *bool             `json:"is_expense"`
	Confidence          *float64          `json:"confidence"`
	Group               *string           `json:"group"`
	NeedsReview         bool              `json:"needs_review"`
	Error               string            `json:"error,omitempty"`
}

type classifyResponse struct {
	Rows    []classifiedTransactionResponse `json:"rows"`
	Skipped int                             `json:"skipped"`
}

// classifyTransactions classifies up to maxClassifyBatch stored rows that do
// not have a classification yet. Ids that are already classified (or are not
// the user's) are reported in Skipped, so re-importing a statement does not
// rerun the classifier over rows a human already reviewed.
func (a *api) classifyTransactions(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	var req classifyRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return
	}
	if len(req.TransactionIDs) == 0 {
		writeJSON(w, http.StatusBadRequest, errorBody("transaction_ids is required"))
		return
	}
	if len(req.TransactionIDs) > maxClassifyBatch {
		writeJSON(w, http.StatusBadRequest, errorBody("too many transaction_ids in one request"))
		return
	}

	rows, err := a.app.Review.UnclassifiedTransactions(r.Context(), user.ID, req.TransactionIDs)
	if err != nil {
		log.Printf("load unclassified transactions: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load transactions"))
		return
	}

	results, err := a.app.Classifications.ClassifyStored(r.Context(), user.ID, rows)
	if err != nil {
		log.Printf("classify transactions: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not classify transactions"))
		return
	}

	categories, err := a.app.Categories.ListCategories(r.Context())
	if err != nil {
		log.Printf("list categories: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load categories"))
		return
	}
	categoryResponses := toCategoryResponses(categories)
	byKey := make(map[string]categoryResponse, len(categoryResponses))
	for _, category := range categoryResponses {
		byKey[category.Key] = category
	}

	rowByID := make(map[uuid.UUID]postgres.StatementTransaction, len(rows))
	resultByID := make(map[uuid.UUID]classifier.Result, len(rows))
	for i, row := range rows {
		rowByID[row.ID] = row
		resultByID[row.ID] = results[i]
	}

	body := classifyResponse{
		Rows:    make([]classifiedTransactionResponse, 0, len(rows)),
		Skipped: len(req.TransactionIDs) - len(rows),
	}
	for _, id := range req.TransactionIDs {
		row, ok := rowByID[id]
		if !ok {
			continue
		}

		result := resultByID[id]
		item := classifiedTransactionResponse{
			ID:                  row.ID.String(),
			Description:         row.Description,
			OriginalDescription: row.OriginalDescription,
			TransactionDate:     row.TransactionDate,
			NeedsReview:         true,
		}

		if result.Err != nil {
			item.Error = result.Err.Error()
		} else {
			isExpense := result.Expense >= 0.5
			confidence := result.Confidence
			item.IsExpense = &isExpense
			item.Confidence = &confidence
			if result.Group != "" {
				item.Group = &result.Group
			}
			if category, ok := byKey[result.Category]; ok {
				item.Category = &category
			}
			item.NeedsReview = classifyNeedsReview(result)
		}

		body.Rows = append(body.Rows, item)
	}

	writeJSON(w, http.StatusOK, body)
}

func (a *api) listCategories(w http.ResponseWriter, r *http.Request) {
	if _, ok := requestUser(w, r); !ok {
		return
	}

	categories, err := a.app.Categories.ListCategories(r.Context())
	if err != nil {
		log.Printf("list categories: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load categories"))
		return
	}

	body := categoryListResponse{Categories: toCategoryResponses(categories)}
	writeJSON(w, http.StatusOK, body)
}

type categoryGroupListResponse struct {
	Groups []categoryGroupResponse `json:"groups"`
}

func toCategoryGroupResponse(group services.CategoryGroupView) categoryGroupResponse {
	return categoryGroupResponse{
		ID:    group.ID.String(),
		Key:   group.Key,
		Label: group.Label,
	}
}

// writeCategoryError maps the admin service errors onto HTTP statuses.
func writeCategoryError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, services.ErrCategoryNotFound), errors.Is(err, services.ErrCategoryGroupNotFound):
		writeJSON(w, http.StatusNotFound, errorBody(err.Error()))
	case errors.Is(err, services.ErrCategoryKeyTaken), errors.Is(err, services.ErrCategoryGroupKeyTaken):
		writeJSON(w, http.StatusConflict, errorBody(err.Error()))
	case errors.Is(err, services.ErrCategoryInvalid), errors.Is(err, services.ErrCategoryGroupInvalid):
		writeJSON(w, http.StatusBadRequest, errorBody(err.Error()))
	default:
		log.Printf("category admin: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not save the change"))
	}
}

func (a *api) listCategoryGroups(w http.ResponseWriter, r *http.Request) {
	if _, ok := requestUser(w, r); !ok {
		return
	}

	groups, err := a.app.Categories.ListGroups(r.Context())
	if err != nil {
		log.Printf("list category groups: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load category groups"))
		return
	}

	body := categoryGroupListResponse{Groups: make([]categoryGroupResponse, 0, len(groups))}
	for _, group := range groups {
		body.Groups = append(body.Groups, toCategoryGroupResponse(group))
	}
	writeJSON(w, http.StatusOK, body)
}

type categoryGroupRequest struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

func (a *api) createCategoryGroup(w http.ResponseWriter, r *http.Request) {
	if _, ok := requestUser(w, r); !ok {
		return
	}

	var req categoryGroupRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return
	}

	group, err := a.app.Categories.CreateGroup(r.Context(), req.Key, req.Label)
	if err != nil {
		writeCategoryError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toCategoryGroupResponse(group))
}

func (a *api) updateCategoryGroup(w http.ResponseWriter, r *http.Request) {
	if _, ok := requestUser(w, r); !ok {
		return
	}

	groupID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category group id is not a uuid"))
		return
	}

	var req categoryGroupRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return
	}

	group, err := a.app.Categories.UpdateGroup(r.Context(), groupID, req.Key, req.Label)
	if err != nil {
		writeCategoryError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toCategoryGroupResponse(group))
}

func (a *api) deleteCategoryGroup(w http.ResponseWriter, r *http.Request) {
	if _, ok := requestUser(w, r); !ok {
		return
	}

	groupID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category group id is not a uuid"))
		return
	}

	if err := a.app.Categories.DeleteGroup(r.Context(), groupID); err != nil {
		writeCategoryError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type categoryWriteRequest struct {
	Key      string       `json:"key"`
	Label    string       `json:"label"`
	Icon     string       `json:"icon"`
	GroupIDs *[]uuid.UUID `json:"group_ids"`
}

func (a *api) createCategory(w http.ResponseWriter, r *http.Request) {
	if _, ok := requestUser(w, r); !ok {
		return
	}

	var req categoryWriteRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return
	}

	category, err := a.app.Categories.CreateCategory(r.Context(), services.CategoryInput{
		Key:      req.Key,
		Label:    req.Label,
		Icon:     req.Icon,
		GroupIDs: req.GroupIDs,
	})
	if err != nil {
		writeCategoryError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toCategoryResponse(category))
}

func (a *api) updateCategory(w http.ResponseWriter, r *http.Request) {
	if _, ok := requestUser(w, r); !ok {
		return
	}

	categoryID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category id is not a uuid"))
		return
	}

	var req categoryWriteRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return
	}

	category, err := a.app.Categories.UpdateCategory(r.Context(), categoryID, services.CategoryInput{
		Key:      req.Key,
		Label:    req.Label,
		Icon:     req.Icon,
		GroupIDs: req.GroupIDs,
	})
	if err != nil {
		writeCategoryError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toCategoryResponse(category))
}

func (a *api) deleteCategory(w http.ResponseWriter, r *http.Request) {
	if _, ok := requestUser(w, r); !ok {
		return
	}

	categoryID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category id is not a uuid"))
		return
	}

	if err := a.app.Categories.DeleteCategory(r.Context(), categoryID); err != nil {
		writeCategoryError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type categoryBudgetCategoryResponse struct {
	ID               string  `json:"id"`
	Key              string  `json:"key"`
	Label            string  `json:"label"`
	Icon             string  `json:"icon"`
	CategoryBudgetID *string `json:"category_budget_id"`
	Allocated        *string `json:"allocated"`
	Spent            string  `json:"spent"`
}

type categoryBudgetGroupResponse struct {
	Key        string                           `json:"key"`
	Label      string                           `json:"label"`
	Categories []categoryBudgetCategoryResponse `json:"categories"`
}

type activeBudgetResponse struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	StartDate *string `json:"start_date"`
	EndDate   *string `json:"end_date"`
}

type categoryBudgetOverviewResponse struct {
	Budget *activeBudgetResponse         `json:"budget"`
	Groups []categoryBudgetGroupResponse `json:"groups"`
}

func toCategoryBudgetOverviewResponse(overview services.CategoryBudgetOverview) categoryBudgetOverviewResponse {
	body := categoryBudgetOverviewResponse{
		Groups: make([]categoryBudgetGroupResponse, 0, len(overview.Groups)),
	}

	if overview.Budget != nil {
		summary := &activeBudgetResponse{
			ID:   overview.Budget.ID.String(),
			Name: overview.Budget.Name,
		}
		if overview.Budget.StartDate != nil {
			value := overview.Budget.StartDate.Format(budgetDayLayout)
			summary.StartDate = &value
		}
		if overview.Budget.EndDate != nil {
			value := overview.Budget.EndDate.Format(budgetDayLayout)
			summary.EndDate = &value
		}
		body.Budget = summary
	}

	for _, group := range overview.Groups {
		groupResponse := categoryBudgetGroupResponse{
			Key:        group.Key,
			Label:      group.Label,
			Categories: make([]categoryBudgetCategoryResponse, 0, len(group.Categories)),
		}
		for _, category := range group.Categories {
			item := categoryBudgetCategoryResponse{
				ID:    category.ID.String(),
				Key:   category.Key,
				Label: category.Label,
				Icon:  category.Icon,
				Spent: category.Spent,
			}
			if category.CategoryBudgetID != nil {
				id := category.CategoryBudgetID.String()
				item.CategoryBudgetID = &id
			}
			if category.Allocated != nil {
				allocated := *category.Allocated
				item.Allocated = &allocated
			}
			groupResponse.Categories = append(groupResponse.Categories, item)
		}
		body.Groups = append(body.Groups, groupResponse)
	}

	return body
}

func writeCategoryBudgetError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, services.ErrNoActiveBudget):
		writeJSON(w, http.StatusConflict, errorBody(err.Error()))
	case errors.Is(err, services.ErrCategoryBudgetNotFound), errors.Is(err, services.ErrCategoryNotFound):
		writeJSON(w, http.StatusNotFound, errorBody(err.Error()))
	case errors.Is(err, services.ErrCategoryBudgetInvalid):
		writeJSON(w, http.StatusBadRequest, errorBody(err.Error()))
	default:
		log.Printf("category budgets: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not save the category budget"))
	}
}

func (a *api) getCategoryBudgets(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	overview, err := a.app.CategoryBudgets.Overview(r.Context(), user.ID)
	if err != nil {
		log.Printf("list category budgets: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load the category budgets"))
		return
	}

	writeJSON(w, http.StatusOK, toCategoryBudgetOverviewResponse(overview))
}

type setCategoryBudgetRequest struct {
	CategoryID      uuid.UUID `json:"category_id"`
	AllocatedAmount float64   `json:"allocated_amount"`
}

func (a *api) setCategoryBudget(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	var req setCategoryBudgetRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return
	}
	if req.CategoryID == uuid.Nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category_id is required"))
		return
	}

	overview, err := a.app.CategoryBudgets.SetBudget(r.Context(), user.ID, req.CategoryID, req.AllocatedAmount)
	if err != nil {
		writeCategoryBudgetError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toCategoryBudgetOverviewResponse(overview))
}

type updateCategoryBudgetRequest struct {
	AllocatedAmount float64 `json:"allocated_amount"`
}

func (a *api) updateCategoryBudget(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	categoryBudgetID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category budget id is not a uuid"))
		return
	}

	var req updateCategoryBudgetRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return
	}

	overview, err := a.app.CategoryBudgets.UpdateBudget(r.Context(), user.ID, categoryBudgetID, req.AllocatedAmount)
	if err != nil {
		writeCategoryBudgetError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toCategoryBudgetOverviewResponse(overview))
}

func (a *api) deleteCategoryBudget(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	categoryBudgetID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category budget id is not a uuid"))
		return
	}

	overview, err := a.app.CategoryBudgets.DeleteBudget(r.Context(), user.ID, categoryBudgetID)
	if err != nil {
		writeCategoryBudgetError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toCategoryBudgetOverviewResponse(overview))
}

// maxCategoryTransactions caps one expanded category. The list is ordered
// newest first, which is what a reviewer wants to see.
const maxCategoryTransactions = 200

func (a *api) listCategoryTransactions(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	categoryID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category id is not a uuid"))
		return
	}

	start, end, err := a.app.CategoryBudgets.ActiveWindow(r.Context(), user.ID)
	if err != nil {
		log.Printf("category window: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load the budget window"))
		return
	}

	rows, err := a.app.Review.CategoryTransactions(r.Context(), user.ID, categoryID, start, end, maxCategoryTransactions)
	if err != nil {
		log.Printf("list category transactions: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load the transactions"))
		return
	}

	transactions := toTransactionResponses(rows)
	writeJSON(w, http.StatusOK, transactionListResponse{
		Transactions: transactions,
		Total:        len(transactions),
	})
}

type correctionRequest struct {
	CategoryID uuid.UUID `json:"category_id"`
	IsExpense  *bool     `json:"is_expense"`
	GroupKey   *string   `json:"group_key"`
}

type correctionResponse struct {
	ID                    string `json:"id"`
	NormalisedDescription string `json:"normalised_description"`
	CategoryID            string `json:"category_id"`
}

type transactionCategoryResponse struct {
	ID         string  `json:"id"`
	CategoryID string  `json:"category_id"`
	Group      *string `json:"group"`
}

type correctionListItemResponse struct {
	ID          string           `json:"id"`
	Description string           `json:"description"`
	Category    categoryResponse `json:"category"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

type correctionsResponse struct {
	Corrections []correctionListItemResponse `json:"corrections"`
}

type correctionWriteRequest struct {
	Description string    `json:"description"`
	CategoryID  uuid.UUID `json:"category_id"`
}

type correctionWriteResponse struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	CategoryID  string `json:"category_id"`
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

	groupKey := ""
	if req.GroupKey != nil {
		groupKey = strings.TrimSpace(*req.GroupKey)
	}

	saved, err := a.app.Corrections.Save(r.Context(), user.ID, services.CorrectionInput{
		StatementTransactionID: transactionID,
		CategoryID:             req.CategoryID,
		IsExpense:              req.IsExpense,
		GroupKey:               groupKey,
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

// updateTransactionCategory replaces one row's category for that row only. No
// correction is recorded, so a merchant with the same description elsewhere is
// unaffected and the classifier keeps classifying future rows the way it did
// before. The review panel is the surface that teaches the classifier.
func (a *api) updateTransactionCategory(w http.ResponseWriter, r *http.Request) {
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

	groupKey := ""
	if req.GroupKey != nil {
		groupKey = strings.TrimSpace(*req.GroupKey)
	}

	saved, err := a.app.Classifications.SetCategory(r.Context(), user.ID, services.SetCategoryInput{
		StatementTransactionID: transactionID,
		CategoryID:             req.CategoryID,
		IsExpense:              req.IsExpense,
		GroupKey:               groupKey,
	})
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, errorBody("statement transaction or category not found"))
		return
	}
	if err != nil {
		log.Printf("update transaction category %s: %v", transactionID, err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not update the category"))
		return
	}

	var group *string
	if saved.GroupKey.Valid {
		group = &saved.GroupKey.String
	}

	writeJSON(w, http.StatusOK, transactionCategoryResponse{
		ID:         saved.StatementTransactionID.String(),
		CategoryID: saved.CategoryID.UUID.String(),
		Group:      group,
	})
}

// listCorrections returns the descriptions the classifier remembers for the
// user, with the category each maps to.
func (a *api) listCorrections(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	items, err := a.app.Corrections.List(r.Context(), user.ID)
	if err != nil {
		log.Printf("list corrections: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load corrections"))
		return
	}

	out := make([]correctionListItemResponse, 0, len(items))
	for _, item := range items {
		out = append(out, correctionListItemResponse{
			ID:          item.ID.String(),
			Description: item.NormalisedDescription,
			Category: categoryResponse{
				ID:     item.CategoryID.String(),
				Key:    item.CategoryKey,
				Label:  item.CategoryLabel,
				Icon:   item.CategoryIcon,
				Groups: []categoryGroupResponse{},
			},
			CreatedAt: item.CreatedAt,
			UpdatedAt: item.UpdatedAt,
		})
	}

	writeJSON(w, http.StatusOK, correctionsResponse{Corrections: out})
}

func (a *api) createCorrection(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	req, ok := decodeCorrectionWrite(w, r)
	if !ok {
		return
	}

	saved, err := a.app.Corrections.Create(r.Context(), user.ID, services.CorrectionWriteInput{
		Description: req.Description,
		CategoryID:  req.CategoryID,
	})
	if writeCorrectionError(w, err, "could not save the correction") {
		return
	}

	writeJSON(w, http.StatusCreated, correctionWriteResponse{
		ID:          saved.ID.String(),
		Description: saved.NormalisedDescription,
		CategoryID:  saved.CategoryID.String(),
	})
}

func (a *api) updateCorrection(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("correction id is not a uuid"))
		return
	}

	req, ok := decodeCorrectionWrite(w, r)
	if !ok {
		return
	}

	saved, err := a.app.Corrections.Update(r.Context(), user.ID, id, services.CorrectionWriteInput{
		Description: req.Description,
		CategoryID:  req.CategoryID,
	})
	if writeCorrectionError(w, err, "could not update the correction") {
		return
	}

	writeJSON(w, http.StatusOK, correctionWriteResponse{
		ID:          saved.ID.String(),
		Description: saved.NormalisedDescription,
		CategoryID:  saved.CategoryID.String(),
	})
}

func (a *api) deleteCorrection(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("correction id is not a uuid"))
		return
	}

	if err := a.app.Corrections.Delete(r.Context(), user.ID, id); err != nil {
		log.Printf("delete correction %s: %v", id, err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not delete the correction"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// decodeCorrectionWrite decodes and validates a create/update body, answering
// the client itself when it is unusable.
func decodeCorrectionWrite(w http.ResponseWriter, r *http.Request) (correctionWriteRequest, bool) {
	var req correctionWriteRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return correctionWriteRequest{}, false
	}
	if strings.TrimSpace(req.Description) == "" {
		writeJSON(w, http.StatusBadRequest, errorBody("description is required"))
		return correctionWriteRequest{}, false
	}
	if req.CategoryID == uuid.Nil {
		writeJSON(w, http.StatusBadRequest, errorBody("category_id is required"))
		return correctionWriteRequest{}, false
	}
	return req, true
}

// writeCorrectionError maps the correction service's errors onto responses and
// reports whether it wrote one.
func writeCorrectionError(w http.ResponseWriter, err error, fallback string) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, services.ErrCorrectionDescriptionRequired):
		writeJSON(w, http.StatusBadRequest, errorBody("description is required"))
	case errors.Is(err, services.ErrCorrectionExists):
		writeJSON(w, http.StatusConflict, errorBody("a correction for that description already exists"))
	case errors.Is(err, sql.ErrNoRows):
		writeJSON(w, http.StatusNotFound, errorBody("correction or category not found"))
	default:
		log.Printf("correction: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody(fallback))
	}
	return true
}

func requestUser(w http.ResponseWriter, r *http.Request) (postgres.User, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorBody("unauthorized"))
		return postgres.User{}, false
	}
	return user, true
}

const budgetDayLayout = "2006-01-02"

type budgetPreferencesResponse struct {
	StartDate string  `json:"start_date"`
	EndDate   string  `json:"end_date"`
	Account   *string `json:"account"`
}

type budgetSalaryResponse struct {
	ID                  string    `json:"id"`
	Description         string    `json:"description"`
	OriginalDescription string    `json:"original_description"`
	TransactionDate     time.Time `json:"transaction_date"`
	Amount              string    `json:"amount"`
}

type budgetResponse struct {
	Preferences       *budgetPreferencesResponse `json:"preferences"`
	CurrentBalance    *string                    `json:"current_balance"`
	SalaryAmount      *string                    `json:"salary_amount"`
	SalaryTransaction *budgetSalaryResponse      `json:"salary_transaction"`
	SpentAmount       *string                    `json:"spent_amount"`
	Accounts          []string                   `json:"accounts"`
}

// getBudget returns the statement-derived budget card: the latest balance, the
// salary anchor in the configured window, and the arithmetic between them.
func (a *api) getBudget(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	overview, err := a.app.Budget.Overview(r.Context(), user.ID)
	if err != nil {
		log.Printf("get budget: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not load budget"))
		return
	}

	writeJSON(w, http.StatusOK, toBudgetResponse(overview))
}

type budgetPreferencesRequest struct {
	StartDate string  `json:"start_date"`
	EndDate   string  `json:"end_date"`
	Account   *string `json:"account"`
}

func (a *api) updateBudgetPreferences(w http.ResponseWriter, r *http.Request) {
	user, ok := requestUser(w, r)
	if !ok {
		return
	}

	var req budgetPreferencesRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid json body"))
		return
	}

	start, err := parseBudgetDay(req.StartDate)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("start_date must be yyyy-mm-dd"))
		return
	}
	end, err := parseBudgetDay(req.EndDate)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody("end_date must be yyyy-mm-dd"))
		return
	}
	if req.Account != nil && strings.TrimSpace(*req.Account) == "" {
		req.Account = nil
	}

	overview, err := a.app.Budget.SetPreferences(r.Context(), user.ID, start, end, req.Account)
	if errors.Is(err, services.ErrBudgetWindowInvalid) {
		writeJSON(w, http.StatusBadRequest, errorBody(err.Error()))
		return
	}
	if err != nil {
		log.Printf("update budget preferences: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody("could not save budget"))
		return
	}

	writeJSON(w, http.StatusOK, toBudgetResponse(overview))
}

func parseBudgetDay(value string) (time.Time, error) {
	return time.Parse(budgetDayLayout, value)
}

func toBudgetResponse(overview services.BudgetOverview) budgetResponse {
	body := budgetResponse{
		CurrentBalance: overview.CurrentBalance,
		SalaryAmount:   overview.SalaryAmount,
		SpentAmount:    overview.SpentAmount,
		Accounts:       overview.Accounts,
	}
	if body.Accounts == nil {
		body.Accounts = []string{}
	}

	if overview.Preferences != nil {
		body.Preferences = &budgetPreferencesResponse{
			StartDate: overview.Preferences.StartDate.Format(budgetDayLayout),
			EndDate:   overview.Preferences.EndDate.Format(budgetDayLayout),
			Account:   overview.Preferences.Account,
		}
	}

	if overview.Salary != nil {
		body.SalaryTransaction = &budgetSalaryResponse{
			ID:                  overview.Salary.ID.String(),
			Description:         overview.Salary.Description,
			OriginalDescription: overview.Salary.OriginalDescription,
			TransactionDate:     overview.Salary.TransactionDate,
			Amount:              overview.Salary.Amount,
		}
	}

	return body
}

func errorBody(message string) map[string]string {
	return map[string]string{"error": message}
}

func toCategoryResponse(view services.CategoryView) categoryResponse {
	groups := make([]categoryGroupResponse, 0, len(view.Groups))
	for _, group := range view.Groups {
		groups = append(groups, categoryGroupResponse{
			ID:    group.ID.String(),
			Key:   group.Key,
			Label: group.Label,
		})
	}

	return categoryResponse{
		ID:     view.ID.String(),
		Key:    view.Key,
		Label:  view.Label,
		Icon:   view.Icon,
		Groups: groups,
	}
}

func toCategoryResponses(views []services.CategoryView) []categoryResponse {
	categories := make([]categoryResponse, 0, len(views))
	for _, view := range views {
		categories = append(categories, toCategoryResponse(view))
	}
	return categories
}

func isMaxBytes(err error) bool {
	var maxBytesErr *http.MaxBytesError
	return errors.As(err, &maxBytesErr)
}

// clampedInt parses a query parameter and keeps it inside [min, max]. Anything
// unparseable or out of range falls back to the default.
func clampedInt(raw string, fallback, min, max int) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < min || value > max {
		return fallback
	}
	return value
}

func toTransactionResponses(rows []postgres.GetClassifiedStatementTransactionsByUserIdPageRow) []transactionResponse {
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
				Group:        nullableString(row.ClassificationGroup),
				Confidence:   nullableRatio(row.Confidence),
				ExpenseProb:  nullableRatio(row.ExpenseProb),
				ClassifiedAt: nullableTime(row.ClassifiedAt),
			}
			if row.CategoryID.Valid {
				txn.Classification.Category = &categoryResponse{
					ID:     row.CategoryID.UUID.String(),
					Key:    row.CategoryKey.String,
					Label:  row.CategoryLabel.String,
					Icon:   row.CategoryIcon.String,
					Groups: []categoryGroupResponse{},
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
func needsReview(row postgres.GetClassifiedStatementTransactionsByUserIdPageRow) bool {
	if row.Source.String == classifications.SourceHuman {
		return false
	}
	confidence := nullableRatio(row.Confidence)
	if confidence == nil {
		return true
	}
	return *confidence < services.NeedsReviewThreshold
}

// classifyNeedsReview mirrors needsReview for a fresh classifier result that
// has not been read back from the database yet.
func classifyNeedsReview(result classifier.Result) bool {
	if result.Err != nil {
		return true
	}
	if result.Source == classifier.SourceRule {
		return false
	}
	return result.Confidence < services.NeedsReviewThreshold
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
