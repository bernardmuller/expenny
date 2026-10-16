-- name: GetAllCategories :many
select * from "categories";

-- name: GetCategoryById :one
select * from "categories" where id = @id;

-- name: GetCategoryByKey :one
select * from "categories" where key = @key;

-- name: CreateCategory :one
INSERT INTO categories (id, key, label, icon, created_at, updated_at)
VALUES (@id, @key, @label, @icon, now(), now())
RETURNING *;

-- name: UpdateCategory :one
UPDATE categories
SET key = @key,
    label = @label,
    icon = @icon,
    updated_at = now()
WHERE id = @id
RETURNING *;

-- name: RestoreCategory :one
UPDATE categories
SET key = @key,
    label = @label,
    icon = @icon,
    deleted_at = NULL,
    updated_at = now()
WHERE id = @id
RETURNING *;

-- name: SoftDeleteCategory :exec
UPDATE categories
SET deleted_at = now(), updated_at = now()
WHERE id = @id;

-- name: GetCategoryGroups :many
SELECT * FROM category_groups ORDER BY label;

-- name: GetCategoryGroupById :one
SELECT * FROM category_groups WHERE id = @id;

-- name: CreateCategoryGroup :one
INSERT INTO category_groups (id, key, label, created_at, updated_at)
VALUES (@id, @key, @label, now(), now())
RETURNING *;

-- name: UpdateCategoryGroup :one
UPDATE category_groups
SET key = @key,
    label = @label,
    updated_at = now()
WHERE id = @id
RETURNING *;

-- name: DeleteCategoryGroup :exec
DELETE FROM category_groups WHERE id = @id;

-- name: GetCategoryGroupMembers :many
SELECT m.category_id, g.key AS group_key
FROM category_group_members m
JOIN category_groups g ON g.id = m.group_id
ORDER BY g.label;

-- name: GetCategoryGroupKeys :many
SELECT g.key AS group_key
FROM category_group_members m
JOIN category_groups g ON g.id = m.group_id
WHERE m.category_id = @category_id
ORDER BY g.label;

-- name: DeleteCategoryGroupMembers :exec
DELETE FROM category_group_members WHERE category_id = @category_id;

-- name: AddCategoryGroupMember :exec
INSERT INTO category_group_members (id, category_id, group_id, created_at, updated_at)
VALUES (@id, @category_id, @group_id, now(), now())
ON CONFLICT (category_id, group_id) DO NOTHING;

-- name: GetCategoriesWithGroups :many
SELECT
  c.id,
  c.key,
  c.label,
  c.icon,
  g.id AS group_id,
  g.key AS group_key,
  g.label AS group_label
FROM categories c
LEFT JOIN category_group_members m ON m.category_id = c.id
LEFT JOIN category_groups g ON g.id = m.group_id
WHERE c.deleted_at IS NULL
ORDER BY c.label, c.id, g.label;
