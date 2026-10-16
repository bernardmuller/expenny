-- Adds common income categories (Salary, Interest, Dividends, Refunds, Bonus,
-- Side income, Rental income) and makes them members of the Income group.
--
-- Safe to re-run: existing keys have their label/icon refreshed, and the
-- membership insert ignores pairs that already exist. Requires the
-- category_groups seed from migration 005 (income group) and the
-- category_group_members join table from migration 008.
--
-- Run against the dev database:
--   psql "postgresql://devuser:devpassword@localhost:6420/devdb" -f dev/add-income-categories.sql
-- or against any environment:
--   psql "$DATABASE_URL" -f dev/add-income-categories.sql

WITH inserted AS (
    INSERT INTO categories (
        id,
        key,
        label,
        icon,
        created_at,
        updated_at,
        deleted_at
    )
    SELECT
        gen_random_uuid(),
        v.key,
        v.label,
        v.icon,
        now(),
        now(),
        NULL
    FROM (VALUES
        ('salary',        'Salary',        '💼'),
        ('interest',      'Interest',      '🏦'),
        ('dividends',     'Dividends',     '📈'),
        ('refund',        'Refunds',       '↩️'),
        ('bonus',         'Bonus',         '🎁'),
        ('side-income',   'Side income',   '🧑💻'),
        ('rental-income', 'Rental income', '🏠')
    ) AS v(key, label, icon)
    ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        icon = EXCLUDED.icon,
        updated_at = now()
    RETURNING id
)
INSERT INTO category_group_members (id, category_id, group_id, created_at, updated_at)
SELECT gen_random_uuid(), inserted.id, income_group.id, now(), now()
FROM inserted
CROSS JOIN (SELECT id FROM category_groups WHERE key = 'income') AS income_group
ON CONFLICT (category_id, group_id) DO NOTHING;
