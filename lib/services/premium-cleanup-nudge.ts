import { getAiCapabilities } from '../../services/ai/config'
import { SettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'
import { ExpoNotifications } from './notifications'

const PREMIUM_ACCESS_STARTED_AT_KEY = 'premium_access_started_at'
const AI_CLEANUP_NUDGE_SENT_AT_KEY = 'ai_cleanup_nudge_sent_at'
const AI_CLEANUP_NUDGE_NOTIFICATION_ID_KEY = 'ai_cleanup_nudge_notification_id'
const AI_CLEANUP_NUDGE_PREFILL = 'Organize, clean up and plan my notes and contexts'
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
const DEV_TRIGGER_DELAY_MS = 30_000

async function scheduleCleanupNudgeAt(triggerAt: number, reason: 'initial_premium' | 'dev_test') {
  await SettingsRepo.init()

  const previousNotificationId = await SettingsRepo.get(AI_CLEANUP_NUDGE_NOTIFICATION_ID_KEY)
  if (previousNotificationId) {
    await ExpoNotifications.cancelNotification(previousNotificationId).catch((err) => {
      logger.warn('Failed to cancel previous cleanup nudge before reschedule', {
        previousNotificationId,
        err,
      })
    })
  }

  const notificationId = await ExpoNotifications.scheduleNotification(
    {
      title: 'AI can organize your Mind Palace',
      body: 'Tap to clean up, organize, and plan your notes and contexts.',
      data: {
        type: 'ai_cleanup_nudge',
        prefill: AI_CLEANUP_NUDGE_PREFILL,
      },
    },
    { date: triggerAt }
  )

  await Promise.all([
    SettingsRepo.set(AI_CLEANUP_NUDGE_SENT_AT_KEY, String(Date.now())),
    SettingsRepo.set(AI_CLEANUP_NUDGE_NOTIFICATION_ID_KEY, notificationId),
  ])

  logger.info('Scheduled premium cleanup nudge', {
    triggerAt,
    notificationId,
    reason,
  })
}

export async function schedulePremiumCleanupNudge(): Promise<void> {
  const aiCapabilities = getAiCapabilities()
  if (!aiCapabilities.premiumEnabled) return

  await SettingsRepo.init()

  const now = Date.now()
  const startedAtRaw = await SettingsRepo.get(PREMIUM_ACCESS_STARTED_AT_KEY)
  const sentAtRaw = await SettingsRepo.get(AI_CLEANUP_NUDGE_SENT_AT_KEY)

  let premiumStartedAt = startedAtRaw ? Number(startedAtRaw) : NaN
  if (!Number.isFinite(premiumStartedAt) || premiumStartedAt <= 0) {
    premiumStartedAt = now
    await SettingsRepo.set(PREMIUM_ACCESS_STARTED_AT_KEY, String(premiumStartedAt))
    logger.info('Recorded premium access start time for cleanup nudge', { premiumStartedAt })
  }

  if (sentAtRaw) {
    logger.info('Premium cleanup nudge already scheduled or sent', { sentAtRaw })
    return
  }

  const triggerAt =
    __DEV__ && aiCapabilities.entitlement.isTestOverride
      ? now + DEV_TRIGGER_DELAY_MS
      : premiumStartedAt + FOURTEEN_DAYS_MS

  await scheduleCleanupNudgeAt(triggerAt, 'initial_premium')
}

export async function resetPremiumCleanupNudgeForDev(): Promise<void> {
  await SettingsRepo.init()

  const existingNotificationId = await SettingsRepo.get(AI_CLEANUP_NUDGE_NOTIFICATION_ID_KEY)
  if (existingNotificationId) {
    await ExpoNotifications.cancelNotification(existingNotificationId).catch((err) => {
      logger.warn('Failed to cancel cleanup nudge during dev reset', {
        existingNotificationId,
        err,
      })
    })
  }

  await Promise.all([
    SettingsRepo.delete(PREMIUM_ACCESS_STARTED_AT_KEY),
    SettingsRepo.delete(AI_CLEANUP_NUDGE_SENT_AT_KEY),
    SettingsRepo.delete(AI_CLEANUP_NUDGE_NOTIFICATION_ID_KEY),
  ])

  logger.info('Reset premium cleanup nudge state for dev')
}

export async function schedulePremiumCleanupNudgeSoonForDev(): Promise<void> {
  return schedulePremiumCleanupNudgeAfterDelayForDev(DEV_TRIGGER_DELAY_MS)
}

export async function schedulePremiumCleanupNudgeAfterDelayForDev(delayMs: number): Promise<void> {
  if (!__DEV__) return

  const aiCapabilities = getAiCapabilities()
  if (!aiCapabilities.premiumEnabled) return

  await resetPremiumCleanupNudgeForDev()
  const now = Date.now()
  await SettingsRepo.set(PREMIUM_ACCESS_STARTED_AT_KEY, String(now))
  await scheduleCleanupNudgeAt(now + Math.max(delayMs, 1000), 'dev_test')
}

export const PremiumCleanupNudge = {
  schedule: schedulePremiumCleanupNudge,
  resetForDev: resetPremiumCleanupNudgeForDev,
  scheduleSoonForDev: schedulePremiumCleanupNudgeSoonForDev,
  scheduleAfterDelayForDev: schedulePremiumCleanupNudgeAfterDelayForDev,
  keys: {
    premiumAccessStartedAt: PREMIUM_ACCESS_STARTED_AT_KEY,
    aiCleanupNudgeSentAt: AI_CLEANUP_NUDGE_SENT_AT_KEY,
  },
  prefill: AI_CLEANUP_NUDGE_PREFILL,
}
