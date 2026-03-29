import { create } from 'zustand'
import { ContextsRepo } from '../db/contexts-repo'
import { FeedbackRepo } from '../db/feedback-repo'
import { NotesRepo } from '../db/notes-repo'
import { logger } from '../utils/logger'

export type Note = {
  id: string
  title: string
  body?: string
  category: 'HAVE' | 'URGENT' | 'NICE'
  contextId?: string | null
  classificationStatus?: 'pending' | 'assigned' | 'error' | 'manual'
  createdAt?: number
  updatedAt?: number
}

export type Context = {
  id: string
  name: string
  category: string
  createdAt: number
}

type NotesStore = {
  // State
  notes: Note[]
  contexts: Context[]
  loading: boolean
  
  // Computed
  pendingCount: number
  
  // Actions
  loadNotes: (category?: string) => Promise<void>
  addNote: (note: Note) => void
  updateNoteClassification: (noteId: string, contextId: string | null, status: 'pending' | 'assigned' | 'error' | 'manual') => void
  addContext: (context: Context) => void
  refreshData: () => Promise<void>
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  contexts: [],
  loading: false,
  
  get pendingCount() {
    return get().notes.filter(n => n.classificationStatus === 'pending').length
  },
  
  loadNotes: async (category?: string) => {
    set({ loading: true })
    try {
      await ContextsRepo.init()
      await NotesRepo.init()
      await FeedbackRepo.init()
      
      const allNotes = await NotesRepo.listAll()
      const allContexts = await ContextsRepo.listContexts()
      
      set({
        notes: (category ? allNotes.filter(n => n.category === category) : allNotes) as Note[],
        contexts: allContexts as Context[],
        loading: false,
      })
      
      logger.info('Notes store loaded', { 
        totalNotes: allNotes.length, 
        filteredNotes: category ? allNotes.filter(n => n.category === category).length : allNotes.length,
        contexts: allContexts.length 
      })
    } catch (err) {
      logger.error('Failed to load notes', { err })
      set({ loading: false })
    }
  },
  
  addNote: (note: Note) => {
    set(state => ({
      notes: [...state.notes, note],
    }))
    logger.info('Note added to store', { noteId: note.id, status: note.classificationStatus })
  },
  
  updateNoteClassification: (noteId: string, contextId: string | null, status: 'pending' | 'assigned' | 'error' | 'manual') => {
    set(state => ({
      notes: state.notes.map(n =>
        n.id === noteId
          ? { ...n, contextId, classificationStatus: status, updatedAt: Date.now() }
          : n
      ),
    }))
    logger.info('Note classification updated in store', { noteId, contextId, status })
  },
  
  addContext: (context: Context) => {
    set(state => {
      // Avoid duplicates
      if (state.contexts.find(c => c.id === context.id)) {
        return state
      }
      return {
        contexts: [...state.contexts, context],
      }
    })
    logger.info('Context added to store', { contextId: context.id, name: context.name })
  },
  
  refreshData: async () => {
    const category = get().notes[0]?.category // Infer category from current notes
    await get().loadNotes(category)
  },
}))
