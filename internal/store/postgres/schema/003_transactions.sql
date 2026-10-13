-- +goose Up
CREATE TABLE IF NOT EXISTS "statement_transactions" (
      "id" uuid PRIMARY KEY NOT NULL,
      "user_id" uuid NOT NULL,
      "account" text NOT NULL,
      "nr" integer NOT NULL,
      "posting_date" timestamp NOT NULL,
      "transaction_date" timestamp NOT NULL,
      "description" text NOT NULL,
      "original_description" text NOT NULL,
      "parent_category" text,
      "category" text,
      "money_in" numeric(10, 2) DEFAULT 0 NOT NULL,
      "money_out" numeric(10, 2) DEFAULT 0 NOT NULL,
      "fee" numeric(10, 2) DEFAULT 0 NOT NULL,
      "balance" numeric(10, 2),
      "dedup_hash" text NOT NULL,
      "created_at" timestamp NOT NULL,
      "updated_at" timestamp NOT NULL,
      CONSTRAINT "statement_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES
      "public"."users"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "statement_transactions_dedup_hash_unique" UNIQUE("dedup_hash")
);
CREATE INDEX IF NOT EXISTS "statement_transactions_user_id_posting_date_idx"
ON "statement_transactions" USING btree ("user_id","posting_date");

CREATE TABLE IF NOT EXISTS "statement_transaction_classifications" (
      "id" uuid PRIMARY KEY NOT NULL,
      "statement_transaction_id" uuid NOT NULL,
      "category_id" uuid,
      "is_expense" boolean,
      "expense_prob" numeric(4, 3),
      "confidence" numeric(4, 3),
      "source" varchar(10) NOT NULL, -- rule | provider | human
      "classifier_version" varchar(50),
      "classified_at" timestamp,
      "created_at" timestamp NOT NULL,
      "updated_at" timestamp NOT NULL,
      CONSTRAINT "stc_statement_transaction_id_fk" FOREIGN KEY ("statement_transaction_id")
      REFERENCES "public"."statement_transactions"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "stc_category_id_fk" FOREIGN KEY ("category_id") REFERENCES
      "public"."categories"("id") ON DELETE set null ON UPDATE no action,
      CONSTRAINT "stc_statement_transaction_id_unique" UNIQUE("statement_transaction_id")
);

CREATE TABLE IF NOT EXISTS "transactions" (
      "id" uuid PRIMARY KEY NOT NULL,
      "user_id" uuid NOT NULL,
      "statement_transaction_id" uuid NOT NULL,
      "category_id" uuid, -- we will probably need to make this not null, transactions might vanish if we can't categorise them under category-budgets
      "description" varchar(255) NOT NULL,
      "amount" numeric(10, 2) NOT NULL, -- signed: negative = money out
      "note" varchar(255),
      "created_at" timestamp NOT NULL,
      "updated_at" timestamp NOT NULL,
      "deleted_at" timestamp,
      CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES
      "public"."users"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "transactions_statement_transaction_id_fk" FOREIGN KEY ("statement_transaction_id")
      REFERENCES "public"."statement_transactions"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "transactions_category_id_fk" FOREIGN KEY ("category_id") REFERENCES
      "public"."categories"("id") ON DELETE set null ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "transactions_statement_transaction_id_idx" ON "transactions" USING btree ("statement_transaction_id");
CREATE INDEX IF NOT EXISTS "transactions_category_id_idx" ON "transactions" USING btree ("category_id");

-- +goose Down
DROP TABLE IF EXISTS "transactions";
DROP TABLE IF EXISTS "statement_transaction_classifications";
DROP TABLE IF EXISTS "statement_transactions";
