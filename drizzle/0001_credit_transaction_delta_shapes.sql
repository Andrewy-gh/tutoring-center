ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'Reservation';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'Reservation Release';

ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS available_delta integer,
  ADD COLUMN IF NOT EXISTS pending_delta integer;

UPDATE credit_transactions
SET
  type = CASE
    WHEN type = 'Session Debit' AND session_id IS NOT NULL AND amount < 0 THEN 'Reservation'::transaction_type
    ELSE type
  END,
  available_delta = CASE
    WHEN type = 'Purchase' THEN amount
    WHEN type = 'Session Debit' AND session_id IS NOT NULL AND amount < 0 THEN amount
    ELSE COALESCE(available_delta, amount)
  END,
  pending_delta = CASE
    WHEN type = 'Purchase' THEN 0
    WHEN type = 'Session Debit' AND session_id IS NOT NULL AND amount < 0 THEN abs(amount)
    ELSE COALESCE(pending_delta, 0)
  END
WHERE
  available_delta IS NULL
  OR pending_delta IS NULL
  OR (type = 'Session Debit' AND session_id IS NOT NULL AND amount < 0);

ALTER TABLE credit_transactions
  ALTER COLUMN available_delta SET DEFAULT 0,
  ALTER COLUMN pending_delta SET DEFAULT 0,
  ALTER COLUMN available_delta SET NOT NULL,
  ALTER COLUMN pending_delta SET NOT NULL;

ALTER TABLE credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_valid_delta_shape_by_type;

ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_valid_delta_shape_by_type CHECK (
    CASE
      WHEN type = 'Purchase' THEN available_delta > 0 AND pending_delta = 0
      WHEN type = 'Reservation' THEN available_delta < 0 AND pending_delta > 0 AND available_delta + pending_delta = 0
      WHEN type = 'Reservation Release'
        THEN available_delta > 0 AND pending_delta < 0 AND available_delta + pending_delta = 0
      WHEN type = 'Session Debit' THEN available_delta = 0 AND pending_delta < 0
      WHEN type = 'Cancellation Fee' THEN available_delta = 0 AND pending_delta < 0
      ELSE TRUE
    END
  );
