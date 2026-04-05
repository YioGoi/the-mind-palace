import { backupDatabaseAsync, deleteDatabaseAsync, openDatabaseSync } from 'expo-sqlite'
import { logger } from '../utils/logger'

export const DB_NAME = 'mindpalace-live.db'
const LEGACY_DB_NAMES = ['mindpalace.db']

let dbInstance: ReturnType<typeof openDatabaseSync> | null = null
let ensurePromise: Promise<void> | null = null

function openDb(databaseName: string) {
  return openDatabaseSync(databaseName)
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = openDb(DB_NAME)
  }
  return dbInstance
}

async function listUserTables(db: ReturnType<typeof openDatabaseSync>): Promise<string[]> {
  try {
    const rows = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )
    return rows.map((row) => row.name)
  } catch {
    return []
  }
}

async function probeWritable(db: ReturnType<typeof openDatabaseSync>) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS __db_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
  await db.runAsync(
    `INSERT OR REPLACE INTO __db_meta (key, value) VALUES (?, ?)`,
    ['lastReadyAt', String(Date.now())]
  )
}

async function migrateLegacyIfNeeded() {
  const liveDb = getDb()
  const liveTables = await listUserTables(liveDb)
  const hasLiveData = liveTables.some((name) => name !== '__db_meta')

  if (hasLiveData) {
    await probeWritable(liveDb)
    logger.info('Writable database ready', { databaseName: DB_NAME, source: 'live' })
    return
  }

  for (const legacyName of LEGACY_DB_NAMES) {
    const legacyDb = openDb(legacyName)
    const legacyTables = await listUserTables(legacyDb)
    const hasLegacyData = legacyTables.some((name) => name !== '__db_meta')
    if (!hasLegacyData) continue

    await backupDatabaseAsync({
      sourceDatabase: legacyDb,
      destDatabase: liveDb,
    })
    await probeWritable(liveDb)
    logger.info('Migrated legacy database to writable database', {
      from: legacyName,
      to: DB_NAME,
      tables: legacyTables,
    })
    return
  }

  await probeWritable(liveDb)
  logger.info('Writable database ready', { databaseName: DB_NAME, source: 'fresh' })
}

export async function ensureWritableDatabase() {
  if (!ensurePromise) {
    ensurePromise = migrateLegacyIfNeeded().catch((err) => {
      ensurePromise = null
      logger.error('Writable database setup failed', { err, databaseName: DB_NAME })
      throw err
    })
  }

  return ensurePromise
}

export async function resetAppDatabase() {
  try {
    if (dbInstance) {
      await dbInstance.closeAsync()
      dbInstance = null
    }

    ensurePromise = null

    await deleteDatabaseAsync(DB_NAME)

    for (const legacyName of LEGACY_DB_NAMES) {
      await deleteDatabaseAsync(legacyName)
    }

    logger.info('App database reset', { databaseName: DB_NAME, legacyNames: LEGACY_DB_NAMES })
  } catch (err) {
    logger.error('App database reset failed', { err, databaseName: DB_NAME })
    throw err
  }
}
