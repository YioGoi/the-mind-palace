import * as Crypto from 'expo-crypto'
import { openDatabaseSync } from 'expo-sqlite'
import { logger } from '../utils/logger'

const db =  openDatabaseSync('mindpalace.db')

export type Note = {
  id: string
  title: string
  body?: string
  category: 'HAVE' | 'URGENT' | 'NICE'
  contextId?: string | null
  classificationStatus?: 'pending' | 'assigned' | 'error'
  createdAt: number
  updatedAt: number
}

export const NotesRepo = {
  async init() {
    try {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT,
          category TEXT NOT NULL,
          contextId TEXT,
          classificationStatus TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `)
      logger.info('NotesRepo initialized')
    } catch (err) {
      logger.error('NotesRepo init failed', { err })
      throw err
    }
  },
  async insert(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'classificationStatus'>): Promise<Note> {
    const id = Crypto.randomUUID()
    const now = Date.now()
    const classificationStatus = 'pending'
    try {
      await db.runAsync(
        `INSERT INTO notes (id, title, body, category, contextId, classificationStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, note.title, note.body ?? null, note.category, note.contextId ?? null, classificationStatus, now, now]
      )
    } catch (err) {
      logger.error('Insert note failed', { err })
      throw err
    }
    logger.info('Note inserted', { id, title: note.title, category: note.category })
    return { ...note, id, createdAt: now, updatedAt: now, classificationStatus }
  },
  async updateClassification(id: string, contextId: string | null, status: string) {
    try {
      await db.runAsync(
        `UPDATE notes SET contextId = ?, classificationStatus = ?, updatedAt = ? WHERE id = ?`,
        [contextId, status, Date.now(), id]
      )
    } catch (err) {
      logger.error('Update classification failed', { err })
      throw err
    }
    logger.info('Note classification updated', { id, contextId, status })
  },
  async getById(id: string): Promise<Note | null> {
    try {
      const rows = await db.getAllAsync<any>(`SELECT * FROM notes WHERE id = ?`, [id])
      const row = rows[0]
      if (!row) return null
      return {
        id: row.id,
        title: row.title,
        body: row.body ?? undefined,
        category: row.category,
        contextId: row.contextId ?? null,
        classificationStatus: row.classificationStatus ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    } catch (err) {
      logger.error('Get note by id failed', { id, err })
      throw err
    }
  },
  async listAll(): Promise<Note[]> {
    try {
      const rows = await db.getAllAsync<any>(`SELECT * FROM notes ORDER BY createdAt DESC`)
      return rows.map(row => ({
        id: row.id,
        title: row.title,
        body: row.body ?? undefined,
        category: row.category,
        contextId: row.contextId ?? null,
        classificationStatus: row.classificationStatus ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))
    } catch (err) {
      logger.error('List all notes failed', { err })
      throw err
    }
  },
  async moveNoteToContext(noteId: string, contextId: string): Promise<string | null> {
    try {
      const note = await NotesRepo.getById(noteId)
      const previousContextId = note?.contextId ?? null
      await db.runAsync(
        `UPDATE notes SET contextId = ?, updatedAt = ? WHERE id = ?`,
        [contextId, Date.now(), noteId]
      )
      logger.info('AI_FEEDBACK', { action: 'move', noteId, previousContextId, newContextId: contextId })
      return previousContextId
    } catch (err) {
      logger.error('Move note to context failed', { noteId, contextId, err })
      throw err
    }
  },
}
