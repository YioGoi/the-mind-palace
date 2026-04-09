import { ContextsRepo } from '../db/contexts-repo'
import { NotesRepo, type Note } from '../db/notes-repo'
import { NotificationManager } from './notification-manager'
import { logger } from '../utils/logger'

export type ContextCategory = 'HAVE' | 'URGENT' | 'NICE'

type MoveContextResult = {
  movedNoteCount: number
  fromCategory: ContextCategory
  toCategory: ContextCategory
  contextName: string
}

function toMovedReminderFields(note: Note, targetCategory: ContextCategory) {
  if (targetCategory === 'URGENT') {
    return {
      category: targetCategory,
      reminderAt: null,
      initialReminderAt: note.initialReminderAt ?? note.reminderAt ?? null,
      dueDate: note.dueDate ?? null,
      status: note.status === 'EXPIRED' ? 'PENDING' as const : note.status,
    }
  }

  return {
    category: targetCategory,
    reminderAt: note.reminderAt ?? note.initialReminderAt ?? null,
    initialReminderAt: null,
    dueDate: null,
    status: note.status === 'EXPIRED' ? 'PENDING' as const : note.status,
  }
}

async function rescheduleMovedNote(noteId: string, targetCategory: ContextCategory) {
  const updatedNote = await NotesRepo.getById(noteId)
  if (!updatedNote || updatedNote.status === 'DONE' || updatedNote.status === 'EXPIRED') return

  if (targetCategory === 'URGENT') {
    if (!updatedNote.initialReminderAt && !updatedNote.dueDate) return
    await NotificationManager.scheduleUrgentBatch(noteId, __DEV__)
    return
  }

  if (!updatedNote.reminderAt) return
  await NotificationManager.scheduleSingleReminder(noteId, updatedNote.reminderAt)
}

export async function moveContextToCategory(
  contextId: string,
  targetCategory: ContextCategory
): Promise<MoveContextResult> {
  await Promise.all([ContextsRepo.init(), NotesRepo.init()])

  const [contexts, notes] = await Promise.all([ContextsRepo.listContexts(), NotesRepo.listAll()])
  const context = contexts.find((item) => item.id === contextId)
  if (!context) {
    throw new Error('Context not found')
  }

  const fromCategory = context.category as ContextCategory
  if (fromCategory === targetCategory) {
    return {
      movedNoteCount: 0,
      fromCategory,
      toCategory: targetCategory,
      contextName: context.name,
    }
  }

  const contextNotes = notes.filter((note) => note.contextId === contextId)

  await ContextsRepo.updateContextCategory(contextId, targetCategory)

  for (const note of contextNotes) {
    await NotificationManager.cancelAllReminders(note.id)
    await NotesRepo.updateNoteCategoryFields(note.id, toMovedReminderFields(note, targetCategory))
    await rescheduleMovedNote(note.id, targetCategory)
  }

  logger.info('Moved context to category', {
    contextId,
    contextName: context.name,
    fromCategory,
    toCategory: targetCategory,
    movedNoteCount: contextNotes.length,
  })

  return {
    movedNoteCount: contextNotes.length,
    fromCategory,
    toCategory: targetCategory,
    contextName: context.name,
  }
}
