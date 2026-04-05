import * as Crypto from 'expo-crypto'
import { logger } from '../utils/logger'
import { ensureWritableDatabase, getDb } from './database'

export type UserFeedback = {
  id: string
  noteId: string
  noteTitle: string
  aiSuggestedContextId: string | null
  userChosenContextId: string
  feedback: 'correct' | 'incorrect'
  createdAt: number
}

export const FeedbackRepo = {
  async init() {
    await ensureWritableDatabase()
    try {
      const db = getDb()
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS user_feedback (
          id TEXT PRIMARY KEY,
          noteId TEXT NOT NULL,
          noteTitle TEXT NOT NULL,
          aiSuggestedContextId TEXT,
          userChosenContextId TEXT NOT NULL,
          feedback TEXT NOT NULL CHECK(feedback IN ('correct', 'incorrect')),
          createdAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_user_feedback_noteId ON user_feedback(noteId);
        CREATE INDEX IF NOT EXISTS idx_user_feedback_createdAt ON user_feedback(createdAt);
      `)
      logger.info('FeedbackRepo initialized')
    } catch (err) {
      logger.error('FeedbackRepo init failed', { err })
      throw err
    }
  },

  async logFeedback(
    noteId: string,
    noteTitle: string,
    aiSuggestedContextId: string | null,
    userChosenContextId: string
  ): Promise<void> {
    const id = Crypto.randomUUID()
    const now = Date.now()
    
    // Determine feedback type
    const feedback: 'correct' | 'incorrect' = 
      aiSuggestedContextId === userChosenContextId ? 'correct' : 'incorrect'

    try {
      const db = getDb()
      await db.runAsync(
        `INSERT INTO user_feedback (id, noteId, noteTitle, aiSuggestedContextId, userChosenContextId, feedback, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, noteId, noteTitle, aiSuggestedContextId, userChosenContextId, feedback, now]
      )
      logger.info('User feedback logged', { 
        id, 
        noteId, 
        feedback, 
        aiSuggestedContextId, 
        userChosenContextId 
      })
    } catch (err) {
      logger.error('Log feedback failed', { err })
      throw err
    }
  },

  async getRecentFeedback(limit: number = 50): Promise<UserFeedback[]> {
    try {
      const db = getDb()
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM user_feedback ORDER BY createdAt DESC LIMIT ?`,
        [limit]
      )
      return rows.map(row => ({
        id: row.id,
        noteId: row.noteId,
        noteTitle: row.noteTitle,
        aiSuggestedContextId: row.aiSuggestedContextId,
        userChosenContextId: row.userChosenContextId,
        feedback: row.feedback as 'correct' | 'incorrect',
        createdAt: row.createdAt,
      }))
    } catch (err) {
      logger.error('Get recent feedback failed', { err })
      throw err
    }
  },

  async getFeedbackForContext(contextId: string): Promise<UserFeedback[]> {
    try {
      const db = getDb()
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM user_feedback 
         WHERE aiSuggestedContextId = ? OR userChosenContextId = ?
         ORDER BY createdAt DESC`,
        [contextId, contextId]
      )
      return rows.map(row => ({
        id: row.id,
        noteId: row.noteId,
        noteTitle: row.noteTitle,
        aiSuggestedContextId: row.aiSuggestedContextId,
        userChosenContextId: row.userChosenContextId,
        feedback: row.feedback as 'correct' | 'incorrect',
        createdAt: row.createdAt,
      }))
    } catch (err) {
      logger.error('Get feedback for context failed', { contextId, err })
      throw err
    }
  },

  async clearAll(): Promise<void> {
    try {
      const db = getDb()
      await db.runAsync(`DELETE FROM user_feedback`)
      logger.info('All feedback cleared')
    } catch (err) {
      logger.error('Clear feedback failed', { err })
      throw err
    }
  },
}
