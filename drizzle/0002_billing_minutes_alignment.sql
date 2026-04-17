ALTER TABLE credit_balances
  RENAME COLUMN amount_available TO available_minutes;

ALTER TABLE credit_balances
  RENAME COLUMN amount_pending TO pending_minutes;

ALTER TABLE credit_balances
  DROP CONSTRAINT IF EXISTS credit_balances_available_nonnegative,
  DROP CONSTRAINT IF EXISTS credit_balances_pending_nonnegative,
  ADD CONSTRAINT credit_balances_available_minutes_nonnegative CHECK (available_minutes >= 0),
  ADD CONSTRAINT credit_balances_pending_minutes_nonnegative CHECK (pending_minutes >= 0);

ALTER TABLE credit_transactions
  RENAME COLUMN available_delta TO available_delta_minutes;

ALTER TABLE credit_transactions
  RENAME COLUMN pending_delta TO pending_delta_minutes;

ALTER TABLE credit_transactions
  RENAME COLUMN available_after TO available_after_minutes;

ALTER TABLE credit_transactions
  RENAME COLUMN pending_after TO pending_after_minutes;

ALTER TABLE credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_nonzero_delta,
  DROP CONSTRAINT IF EXISTS credit_transactions_available_after_nonnegative,
  DROP CONSTRAINT IF EXISTS credit_transactions_pending_after_nonnegative,
  DROP CONSTRAINT IF EXISTS credit_transactions_valid_delta_shape_by_type,
  DROP CONSTRAINT IF EXISTS credit_transactions_valid_delta_shape_by_type_minutes,
  ADD CONSTRAINT credit_transactions_nonzero_delta_minutes
    CHECK (available_delta_minutes <> 0 OR pending_delta_minutes <> 0),
  ADD CONSTRAINT credit_transactions_available_after_minutes_nonnegative
    CHECK (available_after_minutes >= 0),
  ADD CONSTRAINT credit_transactions_pending_after_minutes_nonnegative
    CHECK (pending_after_minutes >= 0),
  ADD CONSTRAINT credit_transactions_valid_delta_shape_by_type_minutes CHECK (
    CASE
      WHEN type = 'purchase' THEN available_delta_minutes > 0 AND pending_delta_minutes = 0
      WHEN type = 'reservation'
        THEN available_delta_minutes < 0
          AND pending_delta_minutes > 0
          AND available_delta_minutes + pending_delta_minutes = 0
      WHEN type = 'reservation_release'
        THEN available_delta_minutes > 0
          AND pending_delta_minutes < 0
          AND available_delta_minutes + pending_delta_minutes = 0
      WHEN type = 'session_debit' THEN available_delta_minutes = 0 AND pending_delta_minutes < 0
      WHEN type = 'cancellation_fee' THEN available_delta_minutes = 0 AND pending_delta_minutes < 0
      ELSE true
    END
  );
