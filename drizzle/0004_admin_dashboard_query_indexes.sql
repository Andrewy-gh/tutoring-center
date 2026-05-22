CREATE INDEX sessions_status_scheduled_at_idx
  ON sessions (status, scheduled_at);

CREATE INDEX credit_transactions_type_session_id_idx
  ON credit_transactions (type, session_id);

CREATE INDEX credit_balances_available_minutes_idx
  ON credit_balances (available_minutes);
