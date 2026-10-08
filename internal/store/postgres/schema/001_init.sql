-- +goose Up
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"onboarded" boolean NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"icon" varchar(10) DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "categories_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "budgets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"start_amount" varchar NOT NULL,
	"current_amount" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"sa_iv" varchar,
	"sa_tag" varchar,
	"ca_iv" varchar,
	"ca_tag" varchar,
	"start_date" timestamp,
	"end_date" timestamp,
	CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "category_budgets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"budget_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"allocated_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "category_budgets_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "category_budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "recurring_expense_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category_id" uuid,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"scheduled_at" varchar NOT NULL,
	CONSTRAINT "recurring_expense_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "recurring_expense_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "recurring_expense_templates_user_id_idx" ON "recurring_expense_templates" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "recurring_expense_templates_user_id_deleted_at_idx" ON "recurring_expense_templates" USING btree ("user_id","deleted_at");
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_expense_templates_user_id_description_active_uq" ON "recurring_expense_templates" USING btree ("user_id","description") WHERE "recurring_expense_templates"."deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"budget_id" uuid NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category_id" uuid,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"note" varchar(255),
	"template_id" uuid,
	CONSTRAINT "expenses_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "expenses_template_id_recurring_expense_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_expense_templates"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "budget_recurring_expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"budget_id" uuid NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category_id" uuid,
	"is_paid" boolean DEFAULT false NOT NULL,
	"expense_id" uuid,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"template_id" uuid,
	"scheduled_at" varchar,
	CONSTRAINT "budget_recurring_expenses_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "budget_recurring_expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "budget_recurring_expenses_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "budget_recurring_expenses_template_id_recurring_expense_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_expense_templates"("id") ON DELETE set null ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "budget_recurring_expenses_budget_id_idx" ON "budget_recurring_expenses" USING btree ("budget_id");
CREATE INDEX IF NOT EXISTS "budget_recurring_expenses_budget_id_deleted_at_idx" ON "budget_recurring_expenses" USING btree ("budget_id","deleted_at");
CREATE INDEX IF NOT EXISTS "budget_recurring_expenses_expense_id_idx" ON "budget_recurring_expenses" USING btree ("expense_id");
CREATE INDEX IF NOT EXISTS "budget_recurring_expenses_template_id_idx" ON "budget_recurring_expenses" USING btree ("template_id");

CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token"),
	CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "user_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "user_categories_user_id_category_id_unique" UNIQUE("user_id","category_id"),
	CONSTRAINT "user_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "user_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);

CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"budget_start_date" integer,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"frequency" varchar(20),
	"custom_duration" integer
);

CREATE TABLE IF NOT EXISTS "chats" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" text,
	"type" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"enabled" boolean NOT NULL,
	"channel" varchar(20) NOT NULL,
	"scheduled_at" date,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"entity_id" uuid,
	CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"channel" varchar(20) NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp NOT NULL,
	"type" text DEFAULT 'none' NOT NULL,
	CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "user_activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_activity_user_id_date_uq" ON "user_activity" USING btree ("user_id","date");
CREATE INDEX IF NOT EXISTS "user_activity_user_id_idx" ON "user_activity" USING btree ("user_id");
