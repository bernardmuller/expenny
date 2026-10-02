-- +goose Up
-- Brings this schema in line with api/src/lib/db/schema.ts as of drizzle
-- migration 0023_better_auth_verifications. Covers the better-auth OIDC/MCP
-- tables (drizzle 0019-0023) plus the accounts/expenses column drift that
-- accumulated against 000_init.sql.
--
-- Guarded with IF [NOT] EXISTS throughout: drizzle-kit and goose target the
-- same database, so whichever runs second must be a no-op.

CREATE TABLE IF NOT EXISTS "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);

CREATE TABLE IF NOT EXISTS "oauth_application" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"metadata" text,
	"client_id" text NOT NULL,
	"client_secret" text,
	"redirect_u_r_ls" text NOT NULL,
	"type" text NOT NULL,
	"disabled" boolean DEFAULT false,
	"user_id" uuid,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "oauth_application_client_id_unique" UNIQUE("client_id"),
	CONSTRAINT "oauth_application_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "oauth_access_token" (
	"id" uuid PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"refresh_token_expires_at" timestamp NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid,
	"scopes" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "oauth_access_token_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "oauth_access_token_refresh_token_unique" UNIQUE("refresh_token"),
	CONSTRAINT "oauth_access_token_client_id_oauth_application_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_application"("client_id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "oauth_access_token_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "oauth_consent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"scopes" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"consent_given" boolean NOT NULL,
	CONSTRAINT "oauth_consent_client_id_oauth_application_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_application"("client_id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "oauth_consent_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "jwks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL
);

-- accounts: better-auth stores provider identifiers as text, and the local
-- password column was never part of the live schema.
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "password";
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "provider_id" text;
ALTER TABLE "accounts" ALTER COLUMN "account_id" DROP NOT NULL;
ALTER TABLE "accounts" ALTER COLUMN "account_id" TYPE text USING "account_id"::text;

-- expenses.category_id is NOT NULL in the live schema.
ALTER TABLE "expenses" ALTER COLUMN "category_id" SET NOT NULL;

-- +goose Down
ALTER TABLE "expenses" ALTER COLUMN "category_id" DROP NOT NULL;

ALTER TABLE "accounts" ALTER COLUMN "account_id" TYPE uuid USING "account_id"::uuid;
ALTER TABLE "accounts" ALTER COLUMN "account_id" SET NOT NULL;
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "provider_id";
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "password" text;

DROP TABLE IF EXISTS "jwks";
DROP TABLE IF EXISTS "oauth_consent";
DROP TABLE IF EXISTS "oauth_access_token";
DROP TABLE IF EXISTS "oauth_application";
DROP TABLE IF EXISTS "auth_verifications";
