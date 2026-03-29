import { ensureWritableDatabase, getDb } from './database'
import { logger } from '../utils/logger'

const TABLE = 'app_settings'

export const SettingsRepo = {
  async init() {
    await ensureWritableDatabase()
    try {
      const db = getDb()
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `)
      logger.info('SettingsRepo initialized')
    } catch (err) {
      logger.error('SettingsRepo init failed', { err })
      throw err
    }
  },

  async get(key: string): Promise<string | null> {
    try {
      const db = getDb()
      const rows = await db.getAllAsync<{ value: string }>(
        `SELECT value FROM ${TABLE} WHERE key = ? LIMIT 1`,
        [key]
      )
      return rows[0]?.value ?? null
    } catch (err) {
      logger.error('SettingsRepo get failed', { key, err })
      throw err
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      const db = getDb()
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLE} (key, value) VALUES (?, ?)`,
        [key, value]
      )
      logger.info('Setting saved', { key, value })
    } catch (err) {
      logger.error('SettingsRepo set failed', { key, err })
      throw err
    }
  },
}
