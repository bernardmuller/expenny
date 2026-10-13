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

-- name: GetClassifiedStatementTransactionsByUserId :many
SELECT
  st.description,
  st.original_description,
  st.transaction_date,
  st.money_in,
  st.money_out,
  c.icon,
  c.label,
  stc.is_expense,
  stc.expense_prob,
  stc.confidence,
  st.balance,
  st.user_id
FROM statement_transactions st
JOIN statement_transaction_classifications stc ON stc.statement_transaction_id = st.id
JOIN categories c ON stc.category_id = c.id
WHERE st.user_id = @user_id;
