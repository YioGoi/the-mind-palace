/* eslint-disable import/first */
jest.mock('expo-sqlite')
jest.mock('expo-crypto')

import { getDb } from '../lib/db/database'
import { SettingsRepo } from '../lib/db/settings-repo'
import { __resetInstallIdCacheForTests, getOrCreateInstallId } from '../lib/services/install-id'

describe('install id service', () => {
  beforeEach(async () => {
    __resetInstallIdCacheForTests()
    await SettingsRepo.init()
    const db = getDb() as { __tables?: Record<string, { rows: unknown[] }> }
    for (const table of Object.values(db.__tables ?? {})) {
      table.rows.length = 0
    }
  })

  test('creates and persists a stable install id', async () => {
    const first = await getOrCreateInstallId()
    const second = await getOrCreateInstallId()

    __resetInstallIdCacheForTests()
    const third = await getOrCreateInstallId()

    expect(first).toBe(second)
    expect(third).toBe(first)
  })
})
