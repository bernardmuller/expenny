-- Mirrors every category in the Expenses and Recurring groups into the Income
-- group. That is what lets an income row be tagged with a spending category:
-- a friend repaying their share of a bill is category=eating-out +
-- group=income, and it shows up in the income picker because eating-out is now
-- an Income member too.
--
-- Safe to re-run: existing (category, group) pairs are skipped.
--
-- Run against the dev database:
--   psql "postgresql://devuser:devpassword@localhost:6420/devdb" -f dev/add-income-memberships.sql
-- or against any environment:
--   psql "$DATABASE_URL" -f dev/add-income-memberships.sql

WITH income_group AS (
    SELECT id FROM category_groups WHERE key = 'income'
),
spending_categories AS (
    SELECT DISTINCT m.category_id
    FROM category_group_members m
    JOIN category_groups source ON source.id = m.group_id
    WHERE source.key IN ('expenses', 'recurring')
)
INSERT INTO category_group_members (id, category_id, group_id, created_at, updated_at)
SELECT gen_random_uuid(), spending_categories.category_id, income_group.id, now(), now()
FROM spending_categories
CROSS JOIN income_group
ON CONFLICT (category_id, group_id) DO NOTHING;
