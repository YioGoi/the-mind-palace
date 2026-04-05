import { create } from 'zustand'
import { SettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'

type UpsellMilestone = 3 | 7

type AiUpsellStore = {
  hasSeenTeaserAt3: boolean
  hasSeenTeaserAt7: boolean
  hasUnlockedAiRevealAt13: boolean
  hydrated: boolean
  initialize: () => Promise<void>
  markTeaserSeen: (milestone: UpsellMilestone) => Promise<void>
  markAiRevealSeen: () => Promise<void>
  resetForDev: () => Promise<void>
}

const TEASER_3_SEEN_KEY = 'ai_upsell_teaser_seen_3'
const TEASER_7_SEEN_KEY = 'ai_upsell_teaser_seen_7'
const AI_REVEAL_SEEN_KEY = 'ai_upsell_reveal_seen_13'

async function persist(key: string, value: string) {
  await SettingsRepo.init()
  await SettingsRepo.set(key, value)
}

export const useAiUpsellStore = create<AiUpsellStore>((set, get) => ({
  hasSeenTeaserAt3: false,
  hasSeenTeaserAt7: false,
  hasUnlockedAiRevealAt13: false,
  hydrated: false,

  initialize: async () => {
    if (get().hydrated) return
    try {
      await SettingsRepo.init()
      const [teaser3, teaser7, reveal] = await Promise.all([
        SettingsRepo.get(TEASER_3_SEEN_KEY),
        SettingsRepo.get(TEASER_7_SEEN_KEY),
        SettingsRepo.get(AI_REVEAL_SEEN_KEY),
      ])

      set({
        hasSeenTeaserAt3: teaser3 === 'true',
        hasSeenTeaserAt7: teaser7 === 'true',
        hasUnlockedAiRevealAt13: reveal === 'true',
        hydrated: true,
      })
    } catch (err) {
      logger.error('AI upsell state load failed', { err })
      set({ hydrated: true })
    }
  },

  markTeaserSeen: async (milestone: UpsellMilestone) => {
    const patch =
      milestone === 3
        ? { hasSeenTeaserAt3: true }
        : { hasSeenTeaserAt7: true }
    set(patch)
    try {
      await persist(milestone === 3 ? TEASER_3_SEEN_KEY : TEASER_7_SEEN_KEY, 'true')
    } catch (err) {
      logger.error('AI upsell teaser save failed', { milestone, err })
    }
  },

  markAiRevealSeen: async () => {
    set({ hasUnlockedAiRevealAt13: true })
    try {
      await persist(AI_REVEAL_SEEN_KEY, 'true')
    } catch (err) {
      logger.error('AI upsell reveal save failed', { err })
    }
  },

  resetForDev: async () => {
    set({
      hasSeenTeaserAt3: false,
      hasSeenTeaserAt7: false,
      hasUnlockedAiRevealAt13: false,
      hydrated: false,
    })
    try {
      await SettingsRepo.init()
      await Promise.all([
        SettingsRepo.delete(TEASER_3_SEEN_KEY),
        SettingsRepo.delete(TEASER_7_SEEN_KEY),
        SettingsRepo.delete(AI_REVEAL_SEEN_KEY),
      ])
    } catch (err) {
      logger.error('AI upsell reset failed', { err })
    } finally {
      await get().initialize()
    }
  },
}))
