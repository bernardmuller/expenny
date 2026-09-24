-- Drop the hand-rolled OAuth 2.1 client-credentials table
DROP TABLE IF EXISTS "oauth_clients";

--> statement-breakpoint

-- better-auth OIDC provider: registered OAuth applications (MCP clients)
CREATE TABLE "oauth_application" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"metadata" text,
	"client_id" uuid NOT NULL,
	"client_secret" text,
	"redirect_u_r_ls" text NOT NULL,
	"type" text NOT NULL,
	"disabled" boolean DEFAULT false,
	"user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "oauth_application_client_id_unique" UNIQUE("client_id")
);

--> statement-breakpoint

-- better-auth OIDC provider: issued access + refresh tokens
CREATE TABLE "oauth_access_token" (
	"id" uuid PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"refresh_token_expires_at" timestamp NOT NULL,
	"client_id" uuid NOT NULL REFERENCES "oauth_application"("client_id") ON DELETE cascade,
	"user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
	"scopes" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "oauth_access_token_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "oauth_access_token_refresh_token_unique" UNIQUE("refresh_token")
);

--> statement-breakpoint

-- better-auth OIDC provider: user consent records
CREATE TABLE "oauth_consent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL REFERENCES "oauth_application"("client_id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"scopes" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"consent_given" boolean NOT NULL
);

--> statement-breakpoint

-- better-auth JWT plugin: JWKS signing keys
CREATE TABLE "jwks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL
);
