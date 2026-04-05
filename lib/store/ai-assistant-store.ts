import { create } from 'zustand'

type AiAssistantStore = {
  visible: boolean
  prefill: string
  open: (prefill?: string) => void
  close: () => void
  clearPrefill: () => void
}

export const useAiAssistantStore = create<AiAssistantStore>((set) => ({
  visible: false,
  prefill: '',

  open: (prefill = '') =>
    set((state) => ({
      visible: true,
      prefill: prefill || state.prefill,
    })),

  close: () => set({ visible: false, prefill: '' }),

  clearPrefill: () => set({ prefill: '' }),
}))
