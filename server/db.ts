// SQLite andmebaas (Node sisseehitatud node:sqlite, välist natiivmoodulit pole vaja).
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'idea',
  mvp_line INTEGER,
  focus_story_id TEXT,
  context TEXT NOT NULL,
  story_counter INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  benefit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idea',
  position INTEGER NOT NULL,
  size TEXT,
  is_view INTEGER NOT NULL DEFAULT 1,
  open_questions TEXT NOT NULL DEFAULT '[]',
  origin TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS criteria (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  element_ids TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mockups (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  spec TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  card TEXT,
  next_steps TEXT NOT NULL DEFAULT '[]',
  is_error INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  story_id TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stories_project ON stories(project_id, position);
CREATE INDEX IF NOT EXISTS idx_criteria_story ON criteria(story_id, position);
CREATE INDEX IF NOT EXISTS idx_mockups_story ON mockups(story_id, version);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, seq);
CREATE INDEX IF NOT EXISTS idx_proposals_project ON proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id, id);
`;

export type DB = DatabaseSync;

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

/** Käivitab funktsiooni ühes transaktsioonis; vea korral kõik muudatused tühistatakse. */
export function transaction<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
