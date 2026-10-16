-- +goose Up
-- A category can belong to more than one group: a split-bill repayment is
-- categorised as eating-out but grouped as income. Move the single group each
-- category currently has into a join table, then drop the column.
CREATE TABLE IF NOT EXISTS "category_group_members" (
      "id" uuid PRIMARY KEY NOT NULL,
      "category_id" uuid NOT NULL,
      "group_id" uuid NOT NULL,
      "created_at" timestamp NOT NULL,
      "updated_at" timestamp NOT NULL,
      CONSTRAINT "category_group_members_category_group_unique"
            UNIQUE ("category_id", "group_id"),
      CONSTRAINT "category_group_members_category_id_fk" FOREIGN KEY ("category_id")
            REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action,
      CONSTRAINT "category_group_members_group_id_fk" FOREIGN KEY ("group_id")
            REFERENCES "public"."category_groups"("id") ON DELETE cascade ON UPDATE no action
);

INSERT INTO "category_group_members" ("id", "category_id", "group_id", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", "category_group_id", now(), now()
FROM "categories"
WHERE "category_group_id" IS NOT NULL
ON CONFLICT ("category_id", "group_id") DO NOTHING;

ALTER TABLE "categories" DROP COLUMN IF EXISTS "category_group_id";

-- +goose Down
ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "category_group_id" uuid REFERENCES "category_groups"("id") ON DELETE set null;

UPDATE "categories" c
SET "category_group_id" = m."group_id"
FROM "category_group_members" m
WHERE m."category_id" = c."id";

DROP TABLE IF EXISTS "category_group_members";
