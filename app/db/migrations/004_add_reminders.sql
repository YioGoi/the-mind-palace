-- Migration: Add reminder fields and notification tracking

-- Add reminder fields to notes table
ALTER TABLE notes ADD COLUMN reminderAt INTEGER;           -- HAVE/NICE: single reminder
ALTER TABLE notes ADD COLUMN initialReminderAt INTEGER;    -- URGENT: first reminder
ALTER TABLE notes ADD COLUMN dueDate INTEGER;              -- URGENT: deadline
ALTER TABLE notes ADD COLUMN status TEXT DEFAULT 'PENDING'; -- PENDING/DONE/EXPIRED

-- Track scheduled notification IDs so we can cancel them
CREATE TABLE IF NOT EXISTS note_notifications (
  id TEXT PRIMARY KEY,
  noteId TEXT NOT NULL,
  notificationId TEXT NOT NULL,
  triggerAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_note_notifications_noteId ON note_notifications(noteId);
CREATE INDEX IF NOT EXISTS idx_note_notifications_triggerAt ON note_notifications(triggerAt);
