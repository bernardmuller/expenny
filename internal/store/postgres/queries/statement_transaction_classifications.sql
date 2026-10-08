-- name: UpsertClassification :one
INSERT INTO statement_transaction_classifications (
    id,
    statement_transaction_id,
    category_id,
    is_expense,
    expense_prob,
    confidence,
    source,
    classifier_version,
    classified_at,
    created_at,
    updated_at
) VALUES (
    @id,
    @statement_transaction_id,
    @category_id,
    @is_expense,
    @expense_prob,
    @confidence,
    @source,
    @classifier_version,
    @classified_at,
    now(),
    now()
)
ON CONFLICT (statement_transaction_id) DO UPDATE SET
     category_id        = EXCLUDED.category_id,
     is_expense         = EXCLUDED.is_expense,
     expense_prob       = EXCLUDED.expense_prob,
     confidence         = EXCLUDED.confidence,
     source             = EXCLUDED.source,
     classifier_version = EXCLUDED.classifier_version,
     classified_at      = EXCLUDED.classified_at,
     updated_at         = now()
WHERE statement_transaction_classifications.source <> 'human'
RETURNING *;

-- name: GetAllClassificationsByUserID :many
SELECT c.*
FROM statement_transaction_classifications c
JOIN statement_transactions st ON st.id = c.statement_transaction_id
WHERE st.user_id = @user_id;
