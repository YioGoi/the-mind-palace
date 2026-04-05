-- Migration: Add user_feedback table to track manual note moves
CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  noteId TEXT NOT NULL,
  noteTitle TEXT NOT NULL,
  aiSuggestedContextId TEXT,
  userChosenContextId TEXT NOT NULL,
  feedback TEXT NOT NULL CHECK(feedback IN ('correct', 'incorrect')),
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_noteId ON user_feedback(noteId);
CREATE INDEX IF NOT EXISTS idx_user_feedback_createdAt ON user_feedback(createdAt);
