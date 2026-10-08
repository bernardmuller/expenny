-- name: UpsertCorrection :one
INSERT INTO corrections (
    id,
    user_id,
    normalised_description,
    category_id,
    created_at,
    updated_at
) VALUES (
    @id,
    @user_id,
    @normalised_description,
    @category_id,
    now(),
    now()
)
ON CONFLICT (user_id, normalised_description) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    updated_at = now()
RETURNING *;

-- name: GetAllCorrectionsByUserId :many
SELECT c.*
FROM corrections c
WHERE c.user_id = @user_id;
