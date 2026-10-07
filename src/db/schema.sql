-- ETMS database schema (Sprint 1)
-- T09: user / account data model   T10: event data model

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('student', 'organizer')),
  club_name     TEXT,                       -- only used for organizer accounts
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL CHECK (length(trim(title)) > 0),
  description  TEXT    NOT NULL CHECK (length(trim(description)) > 0),
  event_date   TEXT    NOT NULL,            -- YYYY-MM-DD
  event_time   TEXT    NOT NULL,            -- HH:MM (24-hour)
  location     TEXT    NOT NULL CHECK (length(trim(location)) > 0),
  capacity     INTEGER NOT NULL CHECK (capacity > 0),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (event_date, event_time);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events (organizer_id);
