CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_tutor_time_overlap;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_tutor_time_overlap
  EXCLUDE USING gist (
    tutor_id WITH =,
    tstzrange(scheduled_at, ends_at, '[)') WITH &&
  )
  WHERE (status NOT IN ('Canceled', 'Rescheduled'));
