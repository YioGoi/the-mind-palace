import { create } from 'zustand'
import { SettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'

type Category = 'HAVE' | 'NICE' | 'URGENT'

type NoteUiHintsStore = {
  hydrated: boolean
  hasSeenDoneActionHint: boolean
  unsortedAiNoticeByCategory: Partial<Record<Category, string>>
  initialize: () => Promise<void>
  dismissDoneActionHint: () => Promise<void>
  showUnsortedAiNotice: (category: Category, message: string) => void
  dismissUnsortedAiNotice: (category: Category) => void
  resetDoneActionHintForDev: () => Promise<void>
}

export const DONE_ACTION_HINT_KEY = 'note_done_action_hint_seen_v2'

export const useNoteUiHintsStore = create<NoteUiHintsStore>((set, get) => ({
  hydrated: false,
  hasSeenDoneActionHint: false,
  unsortedAiNoticeByCategory: {},

  initialize: async () => {
    try {
      await SettingsRepo.init()
      const saved = await SettingsRepo.get(DONE_ACTION_HINT_KEY)
      set({
        hydrated: true,
        hasSeenDoneActionHint: saved === 'true',
      })
    } catch (err) {
      logger.error('Note UI hints load failed', { err })
      set({ hydrated: true })
    }
  },

  dismissDoneActionHint: async () => {
    set({ hasSeenDoneActionHint: true })
    try {
      await SettingsRepo.init()
      await SettingsRepo.set(DONE_ACTION_HINT_KEY, 'true')
    } catch (err) {
      logger.error('Note UI hints save failed', { err })
    }
  },

  showUnsortedAiNotice: (category, message) => {
    set(state => ({
      unsortedAiNoticeByCategory: {
        ...state.unsortedAiNoticeByCategory,
        [category]: message,
      },
    }))
  },

  dismissUnsortedAiNotice: (category) => {
    set(state => {
      const next = { ...state.unsortedAiNoticeByCategory }
      delete next[category]
      return { unsortedAiNoticeByCategory: next }
    })
  },

  resetDoneActionHintForDev: async () => {
    set({ hydrated: false, hasSeenDoneActionHint: false, unsortedAiNoticeByCategory: {} })
    try {
      await SettingsRepo.init()
      await SettingsRepo.delete(DONE_ACTION_HINT_KEY)
    } catch (err) {
      logger.error('Note UI hints reset failed', { err })
    } finally {
      await get().initialize()
    }
  },
}))
