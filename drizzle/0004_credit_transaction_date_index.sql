CREATE INDEX credit_transactions_type_created_at_session_id_idx
  ON credit_transactions (type, created_at, session_id);

