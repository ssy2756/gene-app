-- Run against the Neon Postgres database configured via DATABASE_URL.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  uid TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_data_gin_idx ON reports USING GIN (data);

-- Google Drive ingestion pipeline (see src/lib/google-drive.ts).

-- Single-row table holding the Drive `changes.watch` channel state, so the
-- webhook knows where to resume `changes.list` from and the renewal job
-- knows which channel to replace before it expires.
CREATE TABLE IF NOT EXISTS drive_sync_state (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  page_token TEXT,
  channel_id TEXT,
  resource_id TEXT,
  channel_token TEXT,
  expiration TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracks which Drive files have already been ingested, so repeated change
-- notifications (or a manual poll re-run) don't reprocess the same PDF.
CREATE TABLE IF NOT EXISTS processed_drive_files (
  drive_file_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
