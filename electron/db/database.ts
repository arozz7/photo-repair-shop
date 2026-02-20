import Database from 'better-sqlite3';

export function initializeDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS repair_operations (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id           TEXT UNIQUE NOT NULL,
      source_photo_id  INTEGER,
      source_app       TEXT DEFAULT 'manual',
      original_path    TEXT NOT NULL,
      reference_path   TEXT,
      repaired_path    TEXT,
      strategy         TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'queued',
      stage            TEXT,
      percent          INTEGER DEFAULT 0,
      error_message    TEXT,
      warnings_json    TEXT,
      verification_tier TEXT,
      is_verified      INTEGER DEFAULT 0,
      auto_enhance     INTEGER DEFAULT 0,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at     DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_repair_ops_status ON repair_operations(status);
    CREATE INDEX IF NOT EXISTS idx_repair_ops_job_id ON repair_operations(job_id);

    CREATE TABLE IF NOT EXISTS reference_library (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path       TEXT UNIQUE NOT NULL,
      camera_model    TEXT,
      resolution      TEXT,
      file_format     TEXT,
      added_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec("ALTER TABLE repair_operations ADD COLUMN reference_path TEXT;");
  } catch (e) {
    // Column already exists, ignore
  }

  return db;
}
