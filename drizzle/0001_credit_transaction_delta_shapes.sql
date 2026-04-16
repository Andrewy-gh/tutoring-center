ALTER TABLE credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_valid_delta_shape_by_type;

ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_valid_delta_shape_by_type CHECK (
    CASE
      WHEN type = 'purchase' THEN available_delta > 0 AND pending_delta = 0
      WHEN type = 'reservation' THEN available_delta < 0 AND pending_delta > 0 AND available_delta + pending_delta = 0
      WHEN type = 'reservation_release'
        THEN available_delta > 0 AND pending_delta < 0 AND available_delta + pending_delta = 0
      WHEN type = 'session_debit' THEN available_delta = 0 AND pending_delta < 0
      WHEN type = 'cancellation_fee' THEN available_delta = 0 AND pending_delta < 0
      ELSE TRUE
    END
  );
