-- Migration: Add updatedAt column to notes table if it does not exist
ALTER TABLE notes ADD COLUMN updatedAt INTEGER;