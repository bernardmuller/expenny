-- better-auth's OIDC provider generates client ids with
-- generateRandomString(32, "a-z", "A-Z"), not UUIDs. Registering an MCP client
-- against a uuid column fails with:
--   invalid input syntax for type uuid: "cccRtSnGQwSvZwCdrNzoQVntzLtlbcDU"

ALTER TABLE "oauth_access_token" DROP CONSTRAINT IF EXISTS "oauth_access_token_client_id_fkey";
--> statement-breakpoint
ALTER TABLE "oauth_consent" DROP CONSTRAINT IF EXISTS "oauth_consent_client_id_fkey";
--> statement-breakpoint
ALTER TABLE "oauth_application" DROP CONSTRAINT IF EXISTS "oauth_application_client_id_unique";
--> statement-breakpoint

ALTER TABLE "oauth_application" ALTER COLUMN "client_id" SET DATA TYPE text USING "client_id"::text;
--> statement-breakpoint
ALTER TABLE "oauth_access_token" ALTER COLUMN "client_id" SET DATA TYPE text USING "client_id"::text;
--> statement-breakpoint
ALTER TABLE "oauth_consent" ALTER COLUMN "client_id" SET DATA TYPE text USING "client_id"::text;
--> statement-breakpoint

ALTER TABLE "oauth_application" ADD CONSTRAINT "oauth_application_client_id_unique" UNIQUE("client_id");
--> statement-breakpoint
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_application"("client_id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_application"("client_id") ON DELETE cascade;
