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

-- name: GetClassifiedStatementTransactionsByUserId :many
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
ORDER BY st.transaction_date DESC, st.nr DESC;
