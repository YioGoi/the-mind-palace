import { create } from 'zustand'

type NoteCategory = 'HAVE' | 'URGENT' | 'NICE'

type PendingOpenIntent = {
  noteId: string
  category: NoteCategory
}

type NotificationIntentStore = {
  pendingOpenIntent: PendingOpenIntent | null
  shouldShowDoneHint: boolean
  doneHintNoteId: string | null
  doneHintAcknowledged: boolean
  openFromNotification: (intent: PendingOpenIntent) => void
  consumeOpenIntent: () => void
  dismissDoneHint: () => void
}

export const useNotificationIntentStore = create<NotificationIntentStore>((set, get) => ({
  pendingOpenIntent: null,
  shouldShowDoneHint: false,
  doneHintNoteId: null,
  doneHintAcknowledged: false,

  openFromNotification: (intent) => {
    set({
      pendingOpenIntent: intent,
      shouldShowDoneHint: !get().doneHintAcknowledged,
      doneHintNoteId: !get().doneHintAcknowledged ? intent.noteId : null,
    })
  },

  consumeOpenIntent: () => set({ pendingOpenIntent: null }),

  dismissDoneHint: () =>
    set({
      shouldShowDoneHint: false,
      doneHintNoteId: null,
      doneHintAcknowledged: true,
    }),
}))
