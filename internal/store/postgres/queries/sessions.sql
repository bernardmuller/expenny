-- name: GetActiveSessionByToken :one
select * from "sessions"
where token = $1 and expires_at > now();
