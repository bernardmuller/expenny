-- +goose Up
-- Salary is a category, not a separate flag: the budget anchor is whichever
-- transaction in the window is categorised as salary (by the classifier or a
-- human correction). The explicit pin is gone.
ALTER TABLE "budget_preferences" DROP COLUMN IF EXISTS "salary_transaction_id";

-- +goose Down
ALTER TABLE "budget_preferences"
      ADD COLUMN IF NOT EXISTS "salary_transaction_id" uuid REFERENCES "statement_transactions"("id") ON DELETE set null;
