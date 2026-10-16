-- +goose Up
-- Marks whether the user has looked at a classification yet. It lives with
-- the classification because the highlight in the transactions table is about
-- the classifier's verdict, not the bank row itself. Classifications start
-- unseen (NULL); ticking a row's checkbox writes the timestamp.
ALTER TABLE "statement_transaction_classifications"
      ADD COLUMN IF NOT EXISTS "seen_at" timestamp;

-- +goose Down
ALTER TABLE "statement_transaction_classifications" DROP COLUMN IF EXISTS "seen_at";
