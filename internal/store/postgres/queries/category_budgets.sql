-- name: GetActiveBudgetByUser :one
SELECT * FROM budgets
WHERE user_id = @user_id
  AND is_active = true
  AND deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 1;

-- name: GetCategoryBudgetsByBudget :many
SELECT DISTINCT ON (cb.category_id)
  cb.id,
  cb.category_id,
  cb.allocated_amount,
  c.key AS category_key,
  c.label AS category_label,
  c.icon AS category_icon
FROM category_budgets cb
JOIN categories c ON c.id = cb.category_id
WHERE cb.budget_id = @budget_id
  AND cb.deleted_at IS NULL
ORDER BY cb.category_id, cb.updated_at DESC;

-- name: GetCategoryBudgetForUser :one
SELECT cb.*
FROM category_budgets cb
JOIN budgets b ON b.id = cb.budget_id
WHERE cb.id = @id
  AND b.user_id = @user_id
  AND b.deleted_at IS NULL;

-- name: GetCategoryBudgetByBudgetAndCategory :one
SELECT * FROM category_budgets
WHERE budget_id = @budget_id
  AND category_id = @category_id
  AND deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 1;

-- name: CreateCategoryBudget :one
INSERT INTO category_budgets (
    id,
    budget_id,
    category_id,
    allocated_amount,
    created_at,
    updated_at
) VALUES (
    @id,
    @budget_id,
    @category_id,
    @allocated_amount,
    now(),
    now()
)
RETURNING *;

-- name: UpdateCategoryBudget :one
UPDATE category_budgets
SET allocated_amount = @allocated_amount,
    updated_at = now()
WHERE id = @id
RETURNING *;

-- name: SoftDeleteCategoryBudget :exec
UPDATE category_budgets
SET deleted_at = now(), updated_at = now()
WHERE id = @id;

-- name: GetCategorySpendByGroupByUser :many
SELECT
  c.id AS category_id,
  COALESCE(stc.group_key, '')::text AS group_key,
  COALESCE(cg.label, '')::text AS group_label,
  COALESCE(
    SUM(ABS(st.money_out::numeric) + ABS(st.fee::numeric))
      - SUM(ABS(st.money_in::numeric)),
    0
  )::text AS spent
FROM statement_transactions st
JOIN statement_transaction_classifications stc ON stc.statement_transaction_id = st.id
JOIN categories c ON c.id = stc.category_id
LEFT JOIN category_groups cg ON cg.key = stc.group_key
WHERE st.user_id = @user_id
  AND st.transaction_date >= @start_date
  AND st.transaction_date <= @end_date
GROUP BY c.id, stc.group_key, cg.label;
