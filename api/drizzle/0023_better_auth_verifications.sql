CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);

--> statement-breakpoint

-- better-auth looks rows up by identifier on every callback
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" ("identifier");

--> statement-breakpoint

-- Sweep the rows better-auth left in the app's OTP table while the two shared it.
-- Live app codes (expires_at in the future) are untouched.
DELETE FROM "verifications" WHERE "expires_at" < now();
