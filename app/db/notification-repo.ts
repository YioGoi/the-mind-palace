import { openDatabaseSync } from 'expo-sqlite'
import { logger } from '../utils/logger'

const DB_NAME = 'mindpalace.db'
const TABLE_NAME = 'scheduled_notifications'

export type ScheduledRow = {
  id?: number
  noteId: string
  notificationId: string
  type: 'HAVE' | 'URGENT'
  scheduledAt: number
  meta?: string
}

const db = openDatabaseSync(DB_NAME)

async function execVoid(sql: string) {
  try {
    await db.execAsync(sql)
  } catch (err) {
    logger.error('SQL exec error', { sql, err })
    throw err
  }
}

async function run(sql: string, params: any[] = []) {
  try {
    await db.runAsync(sql, params as any)
  } catch (err) {
    logger.error('SQL run error', { sql, params, err })
    throw err
  }
}

async function getAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const rows = await db.getAllAsync<T>(sql, params as any)
    return rows
  } catch (err) {
    logger.error('SQL getAll error', { sql, params, err })
    throw err
  }
}

export async function initRepo() {
  await execVoid(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    noteId TEXT NOT NULL,
    notificationId TEXT NOT NULL,
    type TEXT NOT NULL,
    scheduledAt INTEGER NOT NULL,
    meta TEXT
  );`)
  logger.info('Notification repo initialized')
}

export async function saveScheduled(row: ScheduledRow) {
  await run(
    `INSERT INTO ${TABLE_NAME} (noteId, notificationId, type, scheduledAt, meta) VALUES (?, ?, ?, ?, ?);`,
    [row.noteId, row.notificationId, row.type, row.scheduledAt, row.meta ?? null]
  )
  logger.info('Saved scheduled', { noteId: row.noteId, notificationId: row.notificationId })
}

export async function getScheduledByNote(noteId: string): Promise<ScheduledRow[]> {
  const rows = await getAll<ScheduledRow>(`SELECT * FROM ${TABLE_NAME} WHERE noteId = ?;`, [noteId])
  return rows
}

export async function deleteByNotificationId(notificationId: string) {
  await run(`DELETE FROM ${TABLE_NAME} WHERE notificationId = ?;`, [notificationId])
  logger.info('Deleted scheduled by notificationId', { notificationId })
}

export async function deleteAllForNote(noteId: string) {
  await run(`DELETE FROM ${TABLE_NAME} WHERE noteId = ?;`, [noteId])
  logger.info('Deleted all scheduled for note', { noteId })
}

export async function listAllScheduled(): Promise<ScheduledRow[]> {
  return await getAll<ScheduledRow>(`SELECT * FROM ${TABLE_NAME};`)
}

export const NotificationRepo = {
  init: initRepo,
  saveScheduled,
  getScheduledByNote,
  deleteByNotificationId,
  deleteAllForNote,
  listAllScheduled,
}
