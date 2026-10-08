-- +goose Up
CREATE TABLE IF NOT EXISTS "corrections" (
      "id" uuid PRIMARY KEY NOT NULL,
      "user_id" uuid NOT NULL,
      "normalised_description" text NOT NULL,
      "category_id" uuid NOT NULL,
      "created_at" timestamp NOT NULL,
      "updated_at" timestamp NOT NULL,
      CONSTRAINT "corrections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "corrections_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "corrections_user_id_description_unique"
      UNIQUE("user_id","normalised_description")
);

-- +goose Down
DROP TABLE IF EXISTS "corrections";
