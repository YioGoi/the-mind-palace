import * as Crypto from 'expo-crypto'
import { logger } from '../utils/logger'
import { ensureWritableDatabase, getDb } from './database'

export type ScheduledNotification = {
  id: string
  noteId: string
  notificationId: string
  triggerAt: number
  createdAt: number
}

let initPromise: Promise<void> | null = null

async function ensureRepoReady() {
  if (!initPromise) {
    initPromise = initRepo().catch((err) => {
      initPromise = null
      throw err
    })
  }

  await initPromise
}

export async function initRepo() {
  await ensureWritableDatabase()
  try {
    const db = getDb()
    await db.execAsync(`
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
    `)
    logger.info('NotificationRepo initialized')
  } catch (err) {
    logger.error('NotificationRepo init failed', { err })
    throw err
  }
}

export async function saveScheduled(noteId: string, notificationId: string, triggerAt: number): Promise<void> {
  const id = Crypto.randomUUID()
  const now = Date.now()
  try {
    await ensureRepoReady()
    const db = getDb()
    await db.runAsync(
      `INSERT INTO note_notifications (id, noteId, notificationId, triggerAt, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [id, noteId, notificationId, triggerAt, now]
    )
    logger.info('Saved scheduled notification', { id, noteId, notificationId, triggerAt })
  } catch (err) {
    logger.error('Save scheduled notification failed', { err })
    throw err
  }
}

export async function getScheduledByNote(noteId: string): Promise<ScheduledNotification[]> {
  try {
    await ensureRepoReady()
    const db = getDb()
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM note_notifications WHERE noteId = ? ORDER BY triggerAt ASC`,
      [noteId]
    )
    return rows.map(row => ({
      id: row.id,
      noteId: row.noteId,
      notificationId: row.notificationId,
      triggerAt: row.triggerAt,
      createdAt: row.createdAt,
    }))
  } catch (err) {
    logger.error('Get scheduled by note failed', { noteId, err })
    throw err
  }
}

export async function deleteByNotificationId(notificationId: string): Promise<void> {
  try {
    await ensureRepoReady()
    const db = getDb()
    await db.runAsync(`DELETE FROM note_notifications WHERE notificationId = ?`, [notificationId])
    logger.info('Deleted scheduled notification', { notificationId })
  } catch (err) {
    logger.error('Delete by notificationId failed', { notificationId, err })
    throw err
  }
}

export async function deleteAllForNote(noteId: string): Promise<void> {
  try {
    await ensureRepoReady()
    const db = getDb()
    await db.runAsync(`DELETE FROM note_notifications WHERE noteId = ?`, [noteId])
    logger.info('Deleted all scheduled notifications for note', { noteId })
  } catch (err) {
    logger.error('Delete all for note failed', { noteId, err })
    throw err
  }
}

export async function listAllScheduled(): Promise<ScheduledNotification[]> {
  try {
    await ensureRepoReady()
    const db = getDb()
    const rows = await db.getAllAsync<any>(`SELECT * FROM note_notifications ORDER BY triggerAt ASC`)
    return rows.map(row => ({
      id: row.id,
      noteId: row.noteId,
      notificationId: row.notificationId,
      triggerAt: row.triggerAt,
      createdAt: row.createdAt,
    }))
  } catch (err) {
    logger.error('List all scheduled failed', { err })
    throw err
  }
}

export const NotificationRepo = {
  init: initRepo,
  saveScheduled,
  getScheduledByNote,
  deleteByNotificationId,
  deleteAllForNote,
  listAllScheduled,
}
