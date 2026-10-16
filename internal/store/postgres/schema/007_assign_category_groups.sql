-- +goose Up
-- Name the column after the table it points at, and make it explicit that it
-- is nullable until every category has been assigned.
ALTER TABLE "categories" RENAME COLUMN "group_id" TO "category_group_id";

-- Assign the groups we can recognise by key first.
UPDATE "categories" SET "category_group_id" = (SELECT "id" FROM "category_groups" WHERE "key" = 'income')
      WHERE "key" IN ('salary', 'income') AND "category_group_id" IS NULL;
UPDATE "categories" SET "category_group_id" = (SELECT "id" FROM "category_groups" WHERE "key" = 'recurring')
      WHERE "key" IN ('subscriptions', 'insurance', 'utilities', 'recurring') AND "category_group_id" IS NULL;
UPDATE "categories" SET "category_group_id" = (SELECT "id" FROM "category_groups" WHERE "key" = 'transfers')
      WHERE "key" IN ('transfer', 'transfers', 'savings', 'investments') AND "category_group_id" IS NULL;
UPDATE "categories" SET "category_group_id" = (SELECT "id" FROM "category_groups" WHERE "key" = 'expenses')
      WHERE "key" IN ('groceries', 'eating-out', 'fuel', 'transport-fuel', 'shopping', 'bank-fees', 'fees') AND "category_group_id" IS NULL;

-- Whatever is left is a spending category by default, so no category starts
-- life ungrouped. These can be reassigned once custom groups exist.
UPDATE "categories" SET "category_group_id" = (SELECT "id" FROM "category_groups" WHERE "key" = 'expenses')
      WHERE "category_group_id" IS NULL;

-- +goose Down
ALTER TABLE "categories" RENAME COLUMN "category_group_id" TO "group_id";
