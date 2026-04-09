// Minimal in-memory mock of expo-sqlite for tests
const dbs = {}

function openDatabaseSync(name) {
  if (!dbs[name]) {
    dbs[name] = createDb()
  }
  return dbs[name]
}

async function backupDatabaseAsync({ sourceDatabase, destDatabase }) {
  if (sourceDatabase && destDatabase && sourceDatabase.__tables && destDatabase.__tables) {
    const clone = JSON.parse(JSON.stringify(sourceDatabase.__tables))
    Object.keys(destDatabase.__tables).forEach((key) => delete destDatabase.__tables[key])
    Object.assign(destDatabase.__tables, clone)
  }
}

function createDb() {
  const tables = {}

  function execAsync(sql) {
    // Handle CREATE TABLE: create simple table structure
    const m = sql.match(/CREATE TABLE IF NOT EXISTS\s+(\w+) \(([^)]+)\)/i)
    if (m) {
      const name = m[1]
      if (!tables[name]) {
        tables[name] = { rows: [] }
      }
      return Promise.resolve()
    }
    return Promise.resolve()
  }

  function runAsync(sql, params) {
    // Very small parser for the queries we use in tests
    const insert = sql.match(/INSERT(?: OR REPLACE)? INTO\s+(\w+) \([^)]*\)\s*VALUES\s*\(([^)]*)\)/i)
    if (insert) {
      const table = insert[1]
      if (!tables[table]) tables[table] = { rows: [] }
      // create row object depending on table schema
      const row = {}
      if (table === 'notes') {
        // columns: id, title, body, category, contextId, alarmAt, initialAlarmAt, dueDate, status
        row.id = params[0]
        row.c1 = params[1]
        row.c2 = params[2]
        row.c3 = params[3]
        row.c4 = params[4]
        row.c5 = params[5]
        row.c6 = params[6]
        row.c7 = params[7]
        row.c8 = params[8]
      } else if (table === 'scheduled_notifications') {
        // columns: noteId, notificationId, type, scheduledAt, meta
        row.noteId = params[0]
        row.notificationId = params[1]
        row.type = params[2]
        row.scheduledAt = params[3]
        row.meta = params[4]
      } else if (table === 'contexts') {
        // contexts: id, name, category, createdAt
        row.id = params[0]
        row.name = params[1]
        row.category = params[2]
        row.createdAt = params[3]
      } else if (table === 'app_settings') {
        row.key = params[0]
        row.value = params[1]
      } else {
        // generic fallback
        Object.assign(row, params.reduce((acc, v, i) => ({ ...acc, ['c' + i]: v }), {}))
        if (params[0]) row.id = params[0]
      }

      // replace existing by id or notificationId
      if (row.id) tables[table].rows = tables[table].rows.filter((r) => r.id !== row.id)
      if (row.notificationId) tables[table].rows = tables[table].rows.filter((r) => r.notificationId !== row.notificationId)
      tables[table].rows.push(row)
      return Promise.resolve({ rowsAffected: 1 })
    }

    // UPDATE notes SET contextId = ?, classificationStatus = ?, updatedAt = ? WHERE id = ?
    const update = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+)\s+WHERE\s+id\s*=\s*\?/i)
    if (update) {
      const table = update[1]
      const t = tables[table]
      if (!t) return Promise.resolve({ rowsAffected: 0 })
      
      const id = params[params.length - 1] // Last param is the WHERE id
      const values = params.slice(0, -1) // All params before the last are SET values
      
      let updated = 0
      t.rows = t.rows.map((r) => {
        if (r.id === id) {
          updated++
          const newRow = { ...r }
          
          // Parse SET clause to map params to columns
          const setClause = update[2]
          const columns = setClause.split(',').map(s => s.trim().split('=')[0].trim())
          
          columns.forEach((col, idx) => {
            newRow[col] = values[idx]
            // Also update legacy column slots for backward compat
            if (col === 'contextId') newRow.c4 = values[idx]
            if (col === 'classificationStatus') newRow.c5 = values[idx]
            if (col === 'updatedAt') newRow.c7 = values[idx]
          })
          
          return newRow
        }
        return r
      })
      return Promise.resolve({ rowsAffected: updated })
    }

    const delId = sql.match(/DELETE FROM\s+(\w+)\s+WHERE\s+id\s*=\s*\?/i)
    if (delId) {
      const table = delId[1]
      const id = params[0]
      if (!tables[table]) return Promise.resolve({ rowsAffected: 0 })
      const before = tables[table].rows.length
      tables[table].rows = tables[table].rows.filter((r) => r.id !== id)
      return Promise.resolve({ rowsAffected: before - tables[table].rows.length })
    }

    const delNotif = sql.match(/DELETE FROM\s+(\w+)\s+WHERE\s+notificationId\s*=\s*\?/i)
    if (delNotif) {
      const table = delNotif[1]
      const notificationId = params[0]
      if (!tables[table]) return Promise.resolve({ rowsAffected: 0 })
      const before = tables[table].rows.length
      tables[table].rows = tables[table].rows.filter((r) => r.notificationId !== notificationId)
      return Promise.resolve({ rowsAffected: before - tables[table].rows.length })
    }

    return Promise.resolve({ rowsAffected: 0 })
  }

  function getAllAsync(sql, params) {
    if (/sqlite_master/i.test(sql)) {
      return Promise.resolve(
        Object.keys(tables).map((name) => ({ name }))
      )
    }

    // SELECT * FROM table WHERE id = ?; or SELECT * FROM table;
    const selWhere = sql.match(/SELECT \* FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i)
    if (selWhere) {
      const table = selWhere[1]
      const col = selWhere[2]
      const val = params[0]
      const t = tables[table]
      if (!t) return Promise.resolve([])
      const found = t.rows.filter((r) => {
        if (col === 'id') return r.id === val
        return r[col] === val
      })
      // Map back to expected column names if c0.. format
      return Promise.resolve(found.map((r) => normalizeRow(r)))
    }

    const selColsWhere = sql.match(/SELECT\s+(.+)\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i)
    if (selColsWhere) {
      const columns = selColsWhere[1].split(',').map((value) => value.trim())
      const table = selColsWhere[2]
      const col = selColsWhere[3]
      const val = params[0]
      const t = tables[table]
      if (!t) return Promise.resolve([])
      const found = t.rows
        .filter((r) => {
          if (col === 'id') return r.id === val
          return r[col] === val
        })
        .map((r) => {
          const normalized = normalizeRow(r)
          return columns.reduce((acc, key) => {
            acc[key] = normalized[key]
            return acc
          }, {})
        })
      return Promise.resolve(found)
    }

    const selAll = sql.match(/SELECT \* FROM\s+(\w+)/i)
    if (selAll) {
      const table = selAll[1]
      const t = tables[table]
      if (!t) return Promise.resolve([])
      return Promise.resolve(t.rows.map((r) => normalizeRow(r)))
    }

    return Promise.resolve([])
  }

  function normalizeRow(r) {
    const normalized = { ...r }
    // Notes row mapping (id, title, body, category, contextId, classificationStatus, createdAt, updatedAt)
    if (r['c1'] !== undefined) normalized.title = r['c1']
    if (r['c2'] !== undefined) normalized.body = r['c2']
    if (r['c3'] !== undefined) normalized.category = r['c3']
    if (r['c4'] !== undefined) normalized.contextId = r['c4']
    if (r['c5'] !== undefined) normalized.classificationStatus = r['c5']
    if (r['c6'] !== undefined) normalized.createdAt = r['c6']
    if (r['c7'] !== undefined) normalized.updatedAt = r['c7']

    // Contexts mapping (id, name, category, createdAt)
    if (r.name === undefined && r['c1'] !== undefined && normalized.title === undefined) normalized.name = r['c1']
    if (r.category === undefined && r['c2'] !== undefined && normalized.category === undefined) normalized.category = r['c2']
    if (r.createdAt === undefined && r['c3'] !== undefined) normalized.createdAt = r['c3']

    // Scheduled notifications mapping
    if (r.noteId !== undefined) normalized.noteId = r.noteId
    if (r.notificationId !== undefined) normalized.notificationId = r.notificationId
    if (r.type !== undefined) normalized.type = r.type
    if (r.scheduledAt !== undefined) normalized.scheduledAt = r.scheduledAt
    if (r.meta !== undefined) normalized.meta = r.meta

    return normalized
  }

  return {
    __tables: tables,
    execAsync,
    runAsync,
    getAllAsync,
  }
}

module.exports = { openDatabaseSync, backupDatabaseAsync }
