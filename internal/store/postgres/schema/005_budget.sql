-- +goose Up
CREATE TABLE IF NOT EXISTS "category_groups" (
      "id" uuid PRIMARY KEY NOT NULL,
      "key" varchar(50) NOT NULL,
      "label" varchar(100) NOT NULL,
      "created_at" timestamp NOT NULL,
      "updated_at" timestamp NOT NULL,
      CONSTRAINT "category_groups_key_unique" UNIQUE ("key")
);

-- The four groups the classifier resolves every category into. Fixed ids keep
-- the seed deterministic across environments.
INSERT INTO "category_groups" ("id", "key", "label", "created_at", "updated_at") VALUES
      ('00000000-0000-0000-0000-0000000000a1', 'income', 'Income', now(), now()),
      ('00000000-0000-0000-0000-0000000000a2', 'recurring', 'Recurring', now(), now()),
      ('00000000-0000-0000-0000-0000000000a3', 'expenses', 'Expenses', now(), now()),
      ('00000000-0000-0000-0000-0000000000a4', 'transfers', 'Transfers', now(), now())
ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "group_id" uuid REFERENCES "category_groups"("id") ON DELETE set null;

-- The rule-based classifier already emits these categories; assign them so a
-- statement classified before this migration still resolves a group.
UPDATE "categories" SET "group_id" = (SELECT "id" FROM "category_groups" WHERE "key" = 'income')
      WHERE "key" IN ('salary', 'income') AND "group_id" IS NULL;
UPDATE "categories" SET "group_id" = (SELECT "id" FROM "category_groups" WHERE "key" = 'expenses')
      WHERE "key" IN ('bank-fees', 'fees') AND "group_id" IS NULL;

ALTER TABLE "statement_transaction_classifications"
      ADD COLUMN IF NOT EXISTS "group_key" varchar(50);

CREATE TABLE IF NOT EXISTS "budget_preferences" (
      "id" uuid PRIMARY KEY NOT NULL,
      "user_id" uuid NOT NULL,
      "account" text,
      "start_date" date NOT NULL,
      "end_date" date NOT NULL,
      "salary_transaction_id" uuid,
      "created_at" timestamp NOT NULL,
      "updated_at" timestamp NOT NULL,
      CONSTRAINT "budget_preferences_user_id_unique" UNIQUE ("user_id"),
      CONSTRAINT "budget_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id")
            REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "budget_preferences_salary_transaction_id_fk" FOREIGN KEY ("salary_transaction_id")
            REFERENCES "public"."statement_transactions"("id") ON DELETE set null ON UPDATE no action
);

-- +goose Down
DROP TABLE IF EXISTS "budget_preferences";
ALTER TABLE "statement_transaction_classifications" DROP COLUMN IF EXISTS "group_key";
ALTER TABLE "categories" DROP COLUMN IF EXISTS "group_id";
DROP TABLE IF EXISTS "category_groups";
