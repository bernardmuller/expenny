-- name: GetAllCategories :many
select * from "categories";

-- name: GetCategoryById :one
select * from "categories" where id = @id;
