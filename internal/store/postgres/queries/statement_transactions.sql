-- name: UpsertStatementTransaction :one
INSERT INTO statement_transactions (
     id,
     user_id,
     account,
     nr,
     posting_date,
     transaction_date,
     description,
     original_description,
     parent_category,
     category,
     money_in,
     money_out,
     fee,
     balance,
     dedup_hash,
     created_at,
     updated_at
) VALUES (
     @id,
     @user_id,
     @account,
     @nr,
     @posting_date,
     @transaction_date,
     @description,
     @original_description,
     @parent_category,
     @category,
     @money_in,
     @money_out,
     @fee,
     @balance,
     @dedup_hash,
     now(),
     now()
)
ON CONFLICT (dedup_hash) DO UPDATE SET updated_at = now()
RETURNING *;

-- name: GetALlStatementTransactionsByUserID :many
SELECT st.*
FROM statement_transactions st
WHERE st.user_id = @user_id;

-- name: GetStatementTransactionById :one
SELECT st.*
FROM statement_transactions st
WHERE st.id = @id AND st.user_id = @user_id;

-- name: GetClassifiedStatementTransactionsByUserIdPage :many
SELECT
  st.id,
  st.nr,
  st.account,
  st.posting_date,
  st.transaction_date,
  st.description,
  st.original_description,
  st.parent_category,
  st.category,
  st.money_in,
  st.money_out,
  st.fee,
  st.balance,
  stc.id AS classification_id,
  stc.is_expense,
  stc.expense_prob,
  stc.confidence,
  stc.source,
  stc.group_key AS classification_group,
  stc.classifier_version,
  stc.classified_at,
  c.id AS category_id,
  c.key AS category_key,
  c.label AS category_label,
  c.icon AS category_icon
FROM statement_transactions st
LEFT JOIN statement_transaction_classifications stc ON stc.statement_transaction_id = st.id
LEFT JOIN categories c ON stc.category_id = c.id
WHERE st.user_id = @user_id
  AND (sqlc.narg('category_id')::uuid IS NULL OR stc.category_id = sqlc.narg('category_id')::uuid)
  AND (sqlc.narg('window_start')::timestamp IS NULL OR st.transaction_date >= sqlc.narg('window_start')::timestamp)
  AND (sqlc.narg('window_end')::timestamp IS NULL OR st.transaction_date <= sqlc.narg('window_end')::timestamp)
ORDER BY st.transaction_date DESC, st.nr DESC
LIMIT @page_limit OFFSET @page_offset;

-- name: CountStatementTransactionsByUser :one
SELECT count(*)
FROM statement_transactions st
WHERE st.user_id = @user_id;

-- name: GetLatestStatementBalance :one
SELECT st.balance
FROM statement_transactions st
WHERE st.user_id = @user_id
  AND st.balance IS NOT NULL
  AND (@account::text = '' OR st.account = @account)
ORDER BY st.transaction_date DESC, st.nr DESC
LIMIT 1;

-- name: GetLatestSalaryTransaction :one
SELECT
  st.id,
  st.description,
  st.original_description,
  st.transaction_date,
  st.money_in
FROM statement_transactions st
JOIN statement_transaction_classifications stc ON stc.statement_transaction_id = st.id
JOIN categories c ON stc.category_id = c.id
WHERE st.user_id = @user_id
  AND st.transaction_date >= @start_date
  AND st.transaction_date < @end_exclusive
  AND (@account::text = '' OR st.account = @account)
  AND c.key = 'salary'
ORDER BY st.transaction_date DESC, st.nr DESC
LIMIT 1;

-- name: ListStatementAccounts :many
SELECT DISTINCT st.account
FROM statement_transactions st
WHERE st.user_id = @user_id
ORDER BY st.account;

-- name: CountStatementTransactionsNeedingReview :one
SELECT count(*)
FROM statement_transactions st
LEFT JOIN statement_transaction_classifications stc ON stc.statement_transaction_id = st.id
WHERE st.user_id = @user_id
  AND (
    stc.id IS NULL
    OR (
      stc.source <> 'human'
      AND (stc.confidence IS NULL OR stc.confidence::float8 < @threshold::float8)
    )
  );

-- name: GetUnclassifiedStatementTransactionsByIds :many
SELECT st.*
FROM statement_transactions st
LEFT JOIN statement_transaction_classifications stc ON stc.statement_transaction_id = st.id
WHERE st.user_id = @user_id AND st.id = ANY(@ids::uuid[]) AND stc.id IS NULL;

-- name: GetUnclassifiedStatementTransactionsByUser :many
SELECT st.*
FROM statement_transactions st
LEFT JOIN statement_transaction_classifications stc ON stc.statement_transaction_id = st.id
WHERE st.user_id = @user_id AND stc.id IS NULL
ORDER BY st.transaction_date, st.nr
LIMIT @page_limit;

-- name: CountUnclassifiedStatementTransactionsByUser :one
SELECT count(*)
FROM statement_transactions st
LEFT JOIN statement_transaction_classifications stc ON stc.statement_transaction_id = st.id
WHERE st.user_id = @user_id AND stc.id IS NULL;
