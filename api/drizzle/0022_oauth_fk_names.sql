-- Baseline reconciliation for the better-auth OIDC/MCP tables.
--
-- 0020 and 0021 were hand-written, so their foreign keys took Postgres's
-- default `<table>_<col>_fkey` names while drizzle's snapshot expects its own
-- `<table>_<col>_<reftable>_<refcol>_fk` convention. The tables themselves
-- already match schema.ts exactly (verified column-by-column against the live
-- database), so this migration only renames constraints — it is metadata-only
-- and moves no data.
--
-- Renaming here rather than regenerating the tables is what lets
-- `drizzle-kit generate` report a clean tree from this point on.

ALTER TABLE "oauth_application" RENAME CONSTRAINT "oauth_application_user_id_fkey" TO "oauth_application_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "oauth_access_token" RENAME CONSTRAINT "oauth_access_token_client_id_fkey" TO "oauth_access_token_client_id_oauth_application_client_id_fk";
--> statement-breakpoint
ALTER TABLE "oauth_access_token" RENAME CONSTRAINT "oauth_access_token_user_id_fkey" TO "oauth_access_token_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "oauth_consent" RENAME CONSTRAINT "oauth_consent_client_id_fkey" TO "oauth_consent_client_id_oauth_application_client_id_fk";
--> statement-breakpoint
ALTER TABLE "oauth_consent" RENAME CONSTRAINT "oauth_consent_user_id_fkey" TO "oauth_consent_user_id_users_id_fk";
