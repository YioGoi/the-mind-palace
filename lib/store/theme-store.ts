import { create } from 'zustand'
import { SettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'

export type ThemePreference = 'system' | 'light' | 'dark'
export type DevAiPlanOverride = 'free' | 'premium' | null

type ThemeStore = {
  preference: ThemePreference
  backgroundAnimationEnabled: boolean
  devAiPlanOverride: DevAiPlanOverride
  hydrated: boolean
  initialize: () => Promise<void>
  setPreference: (preference: ThemePreference) => Promise<void>
  setBackgroundAnimationEnabled: (enabled: boolean) => Promise<void>
  setDevAiPlanOverride: (plan: DevAiPlanOverride) => Promise<void>
}

const THEME_KEY = 'theme_preference'
const BACKGROUND_ANIMATION_KEY = 'background_animation_enabled'
const DEV_AI_PLAN_OVERRIDE_KEY = 'dev_ai_plan_override'

export const useThemeStore = create<ThemeStore>((set, get) => ({
  preference: 'system',
  backgroundAnimationEnabled: true,
  devAiPlanOverride: null,
  hydrated: false,

  initialize: async () => {
    if (get().hydrated) return
    try {
      await SettingsRepo.init()
      const [saved, savedBackgroundAnimation, savedDevAiPlanOverride] = await Promise.all([
        SettingsRepo.get(THEME_KEY),
        SettingsRepo.get(BACKGROUND_ANIMATION_KEY),
        SettingsRepo.get(DEV_AI_PLAN_OVERRIDE_KEY),
      ])
      const preference =
        saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
      const backgroundAnimationEnabled = savedBackgroundAnimation === null
        ? true
        : savedBackgroundAnimation === 'true'
      const devAiPlanOverride =
        savedDevAiPlanOverride === 'free' || savedDevAiPlanOverride === 'premium'
          ? savedDevAiPlanOverride
          : null
      set({ preference, backgroundAnimationEnabled, devAiPlanOverride, hydrated: true })
      logger.info('Theme preference loaded', { preference, backgroundAnimationEnabled, devAiPlanOverride })
    } catch (err) {
      logger.error('Theme preference load failed', { err })
      set({ hydrated: true })
    }
  },

  setPreference: async (preference: ThemePreference) => {
    set({ preference })
    try {
      await SettingsRepo.init()
      await SettingsRepo.set(THEME_KEY, preference)
    } catch (err) {
      logger.error('Theme preference save failed', { preference, err })
    }
  },

  setBackgroundAnimationEnabled: async (enabled: boolean) => {
    set({ backgroundAnimationEnabled: enabled })
    try {
      await SettingsRepo.init()
      await SettingsRepo.set(BACKGROUND_ANIMATION_KEY, String(enabled))
    } catch (err) {
      logger.error('Background animation preference save failed', { enabled, err })
    }
  },

  setDevAiPlanOverride: async (plan: DevAiPlanOverride) => {
    set({ devAiPlanOverride: plan })
    try {
      await SettingsRepo.init()
      await SettingsRepo.set(DEV_AI_PLAN_OVERRIDE_KEY, plan ?? '')
    } catch (err) {
      logger.error('Dev AI plan override save failed', { plan, err })
    }
  },
}))
