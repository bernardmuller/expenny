-- name: UpsertTransaction :one
INSERT INTO transactions (
    id,
    user_id,
    statement_transaction_id,
    category_id,
    description,
    amount,
    note,
    created_at,
    updated_at,
    deleted_at
) VALUES (
    @id,
    @user_id,
    @statement_transaction_id,
    @category_id,
    @description,
    @amount,
    @note,
    now(),
    now(),
    @deleted_at
)
RETURNING *;

-- name: GetAllTransactionsByUserId :many
SELECT t.*
FROM transactions t
WHERE t.user_id = @user_id;
