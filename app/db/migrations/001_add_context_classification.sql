-- Migration: Make notes.contextId nullable and add classificationStatus
PRAGMA foreign_keys=off;

BEGIN TRANSACTION;

-- 1. Rename old table
ALTER TABLE notes RENAME TO notes_old;

-- 2. Create new table with contextId nullable and classificationStatus
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT NOT NULL,
  contextId TEXT,
  classificationStatus TEXT DEFAULT 'pending',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- 3. Copy data
INSERT INTO notes (id, title, body, category, contextId, createdAt, updatedAt)
SELECT id, title, body, category, contextId, createdAt, updatedAt FROM notes_old;

-- 4. Drop old table
DROP TABLE notes_old;

COMMIT;

PRAGMA foreign_keys=on;
