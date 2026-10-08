-- name: UpsertStatementTransaction :one
   INSERT INTO statement_transactions (
     id, user_id, account, nr, posting_date, transaction_date, description,
     original_description, parent_category, category, money_in, money_out,
     fee, balance, dedup_hash, created_at, updated_at
   ) VALUES (
     @id, @user_id, @account, @nr, @posting_date, @transaction_date, @description,
     @original_description, @parent_category, @category, @money_in, @money_out,
     @fee, @balance, @dedup_hash, now(), now()
   )
   ON CONFLICT (dedup_hash) DO UPDATE SET updated_at = now()
   RETURNING *;
