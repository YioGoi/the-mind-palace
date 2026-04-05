import { classifyNoteAsync } from '../../services/classification-pipeline';
import { getAiCapabilities } from '../../services/ai/config';
import { ContextsRepo } from '../db/contexts-repo';
import { NotesRepo } from '../db/notes-repo';
import { useNotesStore } from '../store/notes-store';
import { logger } from '../utils/logger';

type CreateNoteParams = {
  title: string
  body?: string
  category: 'HAVE' | 'URGENT' | 'NICE'
  contextId?: string | null
  autoClassify?: boolean
  source?: 'manual' | 'ai'
}

export async function createNote({
  title,
  body,
  category,
  contextId = null,
  autoClassify,
  source = 'manual',
}: CreateNoteParams) {
  await ContextsRepo.init()
  await NotesRepo.init()

  const shouldAutoClassify = autoClassify ?? false
  const aiCapabilities = getAiCapabilities()
  const canAutoClassify = shouldAutoClassify && aiCapabilities.canAutoClassifyNotes
  const shouldAssignImmediately = Boolean(contextId)
  const classificationStatus = shouldAssignImmediately
    ? 'assigned'
    : canAutoClassify
    ? 'pending'
    : 'manual'

  const note = await NotesRepo.insert({
    title: title.trim(),
    body: body?.trim() || undefined,
    category,
    contextId,
    classificationStatus,
  })

  logger.info('NOTE_CREATED', {
    noteId: note.id,
    title: note.title,
    status: classificationStatus,
    source,
  })

  useNotesStore.getState().addNote(note)

  if (canAutoClassify) {
    classifyNoteAsync(note.id).catch(err => {
      logger.error('Classification failed (async)', { noteId: note.id, err })
    })
  }

  return note
}
