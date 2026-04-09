import * as Crypto from 'expo-crypto'
import { logger } from '../utils/logger'
import { ensureWritableDatabase, getDb } from './database'
import { FeedbackRepo } from './feedback-repo'

export type Note = {
  id: string
  title: string
  body?: string
  category: 'HAVE' | 'URGENT' | 'NICE'
  contextId?: string | null
  classificationStatus?: 'pending' | 'assigned' | 'error' | 'manual'
  // Reminder fields
  reminderAt?: number | null           // HAVE/NICE: single reminder
  initialReminderAt?: number | null    // URGENT: first reminder
  dueDate?: number | null              // URGENT: deadline
  status?: 'PENDING' | 'DONE' | 'EXPIRED'
  createdAt: number
  updatedAt: number
}

let notesInitPromise: Promise<void> | null = null

async function initializeNotesRepo() {
  await ensureWritableDatabase()
  const db = getDb()
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

  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(notes)`)
  const columnNames = new Set(columns.map((column) => column.name))

  if (!columnNames.has('reminderAt')) {
    await db.execAsync(`ALTER TABLE notes ADD COLUMN reminderAt INTEGER`)
  }

  if (!columnNames.has('initialReminderAt')) {
    await db.execAsync(`ALTER TABLE notes ADD COLUMN initialReminderAt INTEGER`)
  }

  if (!columnNames.has('dueDate')) {
    await db.execAsync(`ALTER TABLE notes ADD COLUMN dueDate INTEGER`)
  }

  if (!columnNames.has('status')) {
    await db.execAsync(`ALTER TABLE notes ADD COLUMN status TEXT DEFAULT 'PENDING'`)
  }

  logger.info('NotesRepo initialized')
}

export const NotesRepo = {
  async init() {
    if (!notesInitPromise) {
      notesInitPromise = initializeNotesRepo().catch((err) => {
        notesInitPromise = null
        logger.error('NotesRepo init failed', { err })
        throw err
      })
    }

    return notesInitPromise
  },
  async insert(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const id = Crypto.randomUUID()
    const now = Date.now()
    const classificationStatus = note.classificationStatus ?? (note.contextId ? 'assigned' : 'manual')
    try {
      const db = getDb()
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
      const db = getDb()
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
      const db = getDb()
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
        reminderAt: row.reminderAt ?? null,
        initialReminderAt: row.initialReminderAt ?? null,
        dueDate: row.dueDate ?? null,
        status: row.status ?? 'PENDING',
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
      const db = getDb()
      const rows = await db.getAllAsync<any>(`SELECT * FROM notes ORDER BY createdAt DESC`)
      return rows.map(row => ({
        id: row.id,
        title: row.title,
        body: row.body ?? undefined,
        category: row.category,
        contextId: row.contextId ?? null,
        classificationStatus: row.classificationStatus ?? undefined,
        reminderAt: row.reminderAt ?? null,
        initialReminderAt: row.initialReminderAt ?? null,
        dueDate: row.dueDate ?? null,
        status: row.status ?? 'PENDING',
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
      if (!note) {
        logger.error('Cannot move note: note not found', { noteId })
        return null
      }
      
      const previousContextId = note.contextId ?? null
      const db = getDb()
      await db.runAsync(
        `UPDATE notes SET contextId = ?, updatedAt = ? WHERE id = ?`,
        [contextId, Date.now(), noteId]
      )
      
      // Log user feedback - user manually moved the note
      // If AI had assigned a context and user moves it, that's feedback
      if (note.classificationStatus === 'assigned' && previousContextId) {
        await FeedbackRepo.logFeedback(
          noteId,
          note.title,
          previousContextId, // AI suggested this
          contextId // User chose this instead
        )
      }
      
      logger.info('Note moved to context', { 
        noteId, 
        previousContextId, 
        newContextId: contextId,
        feedbackLogged: note.classificationStatus === 'assigned' && previousContextId 
      })
      
      return previousContextId
    } catch (err) {
      logger.error('Move note to context failed', { noteId, contextId, err })
      throw err
    }
  },
  async clearContext(contextId: string): Promise<number> {
    try {
      const db = getDb()
      const rows = await db.getAllAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM notes WHERE contextId = ?`,
        [contextId]
      )
      const affectedCount = rows[0]?.count ?? 0

      await db.runAsync(
        `UPDATE notes SET contextId = NULL, classificationStatus = ?, updatedAt = ? WHERE contextId = ?`,
        ['manual', Date.now(), contextId]
      )

      logger.info('Cleared context from notes', { contextId, affectedCount })
      return affectedCount
    } catch (err) {
      logger.error('Clear context from notes failed', { contextId, err })
      throw err
    }
  },
  async updateReminder(noteId: string, reminderAt: number | null): Promise<void> {
    try {
      const db = getDb()
      await db.runAsync(
        `UPDATE notes SET reminderAt = ?, updatedAt = ? WHERE id = ?`,
        [reminderAt, Date.now(), noteId]
      )
      logger.info('Note reminder updated', { noteId, reminderAt })
    } catch (err) {
      logger.error('Update reminder failed', { noteId, err })
      throw err
    }
  },
  async updateUrgentReminders(noteId: string, initialReminderAt: number | null, dueDate: number | null): Promise<void> {
    try {
      const db = getDb()
      await db.runAsync(
        `UPDATE notes SET initialReminderAt = ?, dueDate = ?, updatedAt = ? WHERE id = ?`,
        [initialReminderAt, dueDate, Date.now(), noteId]
      )
      logger.info('Urgent reminders updated', { noteId, initialReminderAt, dueDate })
    } catch (err) {
      logger.error('Update urgent reminders failed', { noteId, err })
      throw err
    }
  },
  async updateContent(noteId: string, title: string, body: string | null): Promise<void> {
    try {
      const db = getDb()
      await db.runAsync(
        `UPDATE notes SET title = ?, body = ?, updatedAt = ? WHERE id = ?`,
        [title, body, Date.now(), noteId]
      )
      logger.info('Note content updated', { noteId })
    } catch (err) {
      logger.error('Update note content failed', { noteId, err })
      throw err
    }
  },
  async updateStatus(noteId: string, status: 'PENDING' | 'DONE' | 'EXPIRED'): Promise<void> {
    try {
      const db = getDb()
      await db.runAsync(
        `UPDATE notes SET status = ?, updatedAt = ? WHERE id = ?`,
        [status, Date.now(), noteId]
      )
      logger.info('Note status updated', { noteId, status })
    } catch (err) {
      logger.error('Update status failed', { noteId, err })
      throw err
    }
  },
  async deleteNote(noteId: string): Promise<void> {
    try {
      const db = getDb()
      await db.runAsync(`DELETE FROM notes WHERE id = ?`, [noteId])
      logger.info('Note deleted', { noteId })
    } catch (err) {
      logger.error('Delete note failed', { noteId, err })
      throw err
    }
  },
  async updateCategoryForContext(
    contextId: string,
    category: 'HAVE' | 'URGENT' | 'NICE',
    options?: {
      reminderAt?: number | null
      initialReminderAt?: number | null
      dueDate?: number | null
      status?: 'PENDING' | 'DONE' | 'EXPIRED'
    }
  ): Promise<number> {
    try {
      const db = getDb()
      const rows = await db.getAllAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM notes WHERE contextId = ?`,
        [contextId]
      )
      const affectedCount = rows[0]?.count ?? 0

      await db.runAsync(
        `UPDATE notes
         SET category = ?,
             reminderAt = ?,
             initialReminderAt = ?,
             dueDate = ?,
             status = COALESCE(?, status),
             updatedAt = ?
         WHERE contextId = ?`,
        [
          category,
          options?.reminderAt ?? null,
          options?.initialReminderAt ?? null,
          options?.dueDate ?? null,
          options?.status ?? null,
          Date.now(),
          contextId,
        ]
      )
      logger.info('Updated note categories for context', { contextId, category, affectedCount })
      return affectedCount
    } catch (err) {
      logger.error('Update note categories for context failed', { contextId, category, err })
      throw err
    }
  },
  async updateNoteCategoryFields(
    noteId: string,
    params: {
      category: 'HAVE' | 'URGENT' | 'NICE'
      reminderAt: number | null
      initialReminderAt: number | null
      dueDate: number | null
      status?: 'PENDING' | 'DONE' | 'EXPIRED'
    }
  ): Promise<void> {
    try {
      const db = getDb()
      await db.runAsync(
        `UPDATE notes
         SET category = ?,
             reminderAt = ?,
             initialReminderAt = ?,
             dueDate = ?,
             status = COALESCE(?, status),
             updatedAt = ?
         WHERE id = ?`,
        [
          params.category,
          params.reminderAt,
          params.initialReminderAt,
          params.dueDate,
          params.status ?? null,
          Date.now(),
          noteId,
        ]
      )
      logger.info('Updated note category fields', { noteId, category: params.category })
    } catch (err) {
      logger.error('Update note category fields failed', { noteId, params, err })
      throw err
    }
  },
}
