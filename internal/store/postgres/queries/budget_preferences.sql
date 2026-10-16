-- name: GetBudgetPreferenceByUser :one
SELECT *
FROM budget_preferences
WHERE user_id = @user_id;

-- name: UpsertBudgetPreference :one
INSERT INTO budget_preferences (
    id,
    user_id,
    account,
    start_date,
    end_date,
    created_at,
    updated_at
) VALUES (
    @id,
    @user_id,
    @account,
    @start_date,
    @end_date,
    now(),
    now()
)
ON CONFLICT (user_id) DO UPDATE SET
    account = EXCLUDED.account,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    updated_at = now()
RETURNING *;
