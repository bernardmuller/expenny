-- name: GetAllUsers :many
select * from "users";

-- name: GetUserByID :one
select * from "users" where id = $1;
