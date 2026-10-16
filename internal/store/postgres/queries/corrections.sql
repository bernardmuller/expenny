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

-- name: GetCorrectionsByUser :many
SELECT
    c.id,
    c.normalised_description,
    c.category_id,
    c.created_at,
    c.updated_at,
    cat.key   AS category_key,
    cat.label AS category_label,
    cat.icon  AS category_icon
FROM corrections c
JOIN categories cat ON cat.id = c.category_id
WHERE c.user_id = @user_id
ORDER BY c.normalised_description;

-- name: GetCorrectionByDescription :one
SELECT * FROM corrections
WHERE user_id = @user_id
  AND normalised_description = @normalised_description;

-- name: UpdateCorrection :one
UPDATE corrections
SET normalised_description = @normalised_description,
    category_id = @category_id,
    updated_at = now()
WHERE id = @id
  AND user_id = @user_id
RETURNING *;

-- name: DeleteCorrection :exec
DELETE FROM corrections
WHERE id = @id
  AND user_id = @user_id;
