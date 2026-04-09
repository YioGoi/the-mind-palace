import * as Crypto from 'expo-crypto'
import { SettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'

const INSTALL_ID_KEY = 'ai_install_id'

let cachedInstallId: string | null = null
let pendingInstallIdPromise: Promise<string> | null = null

function maskInstallId(value: string) {
  return value.length <= 8 ? value : `${value.slice(0, 4)}…${value.slice(-4)}`
}

export async function getOrCreateInstallId(): Promise<string> {
  if (cachedInstallId) return cachedInstallId
  if (pendingInstallIdPromise) return pendingInstallIdPromise

  pendingInstallIdPromise = (async () => {
    await SettingsRepo.init()

    const existing = (await SettingsRepo.get(INSTALL_ID_KEY))?.trim()
    if (existing) {
      cachedInstallId = existing
      return existing
    }

    const generated = Crypto.randomUUID()
    await SettingsRepo.set(INSTALL_ID_KEY, generated)
    cachedInstallId = generated
    logger.info('Generated AI install id', { installId: maskInstallId(generated) })
    return generated
  })()

  try {
    return await pendingInstallIdPromise
  } finally {
    pendingInstallIdPromise = null
  }
}

export function __resetInstallIdCacheForTests() {
  cachedInstallId = null
  pendingInstallIdPromise = null
}
