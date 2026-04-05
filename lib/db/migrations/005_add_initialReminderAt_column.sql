-- Migration: Ensure initialReminderAt column exists on notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS initialReminderAt INTEGER;