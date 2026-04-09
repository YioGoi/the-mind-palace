import { logger } from '../utils/logger'
import { ensureWritableDatabase, getDb } from './database'

const TABLE = 'contexts'

async function execVoid(sql: string) {
  try {
    const db = getDb()
    await db.execAsync(sql)
  } catch (err) {
    logger.error('SQL exec error (contexts)', { sql, err })
    throw err
  }
}

async function run(sql: string, params: any[] = []) {
  try {
    const db = getDb()
    await db.runAsync(sql, params as any)
  } catch (err) {
    logger.error('SQL run error (contexts)', { sql, params, err })
    throw err
  }
}

async function getAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const db = getDb()
    const rows = await db.getAllAsync<T>(sql, params as any)
    return rows
  } catch (err) {
    logger.error('SQL getAll error (contexts)', { sql, params, err })
    throw err
  }
}

export async function initContextsRepo() {
  await ensureWritableDatabase()
  await execVoid(`CREATE TABLE IF NOT EXISTS ${TABLE} (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    createdAt INTEGER
  );`)
  logger.info('Contexts repo initialized')
}

export async function createContexts(names: string[], category = 'HAVE') {
  const now = Date.now()
  for (const name of names) {
    const id = `${category.toLowerCase()}-${now}-${Math.random().toString(36).slice(2, 8)}`
    await run(`INSERT INTO ${TABLE} (id, name, category, createdAt) VALUES (?, ?, ?, ?);`, [id, name, category, now])
  }
  logger.info('Created contexts', { count: names.length })
}

export async function createContext(name: string, category = 'HAVE') {
  const now = Date.now()
  const id = `${category.toLowerCase()}-${now}-${Math.random().toString(36).slice(2, 8)}`
  await run(`INSERT INTO ${TABLE} (id, name, category, createdAt) VALUES (?, ?, ?, ?);`, [id, name, category, now])
  logger.info('Created context', { id, category, name })
  return { id, name, category, createdAt: now }
}

export async function updateContextName(id: string, name: string) {
  await run(`UPDATE ${TABLE} SET name = ? WHERE id = ?;`, [name, id])
  logger.info('Updated context', { id })
}

export async function updateContextCategory(id: string, category: 'HAVE' | 'URGENT' | 'NICE') {
  await run(`UPDATE ${TABLE} SET category = ? WHERE id = ?;`, [category, id])
  logger.info('Updated context category', { id, category })
}

export async function deleteContext(id: string) {
  await run(`DELETE FROM ${TABLE} WHERE id = ?;`, [id])
  logger.info('Deleted context', { id })
}

export async function listContexts() {
  const rows = await getAll<any>(`SELECT * FROM ${TABLE};`)
  return rows.map((r) => ({ id: r.id, name: r.name, category: r.category, createdAt: r.createdAt }))
}

export const ContextsRepo = {
  init: initContextsRepo,
  createContext,
  createContexts,
  updateContextName,
  updateContextCategory,
  deleteContext,
  listContexts,
}
