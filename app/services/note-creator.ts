import { classifyNoteAsync } from '../../services/classification-pipeline';
import { ContextsRepo } from '../db/contexts-repo';
import { NotesRepo } from '../db/notes-repo';
import { useNotesStore } from '../store/notes-store';
import { logger } from '../utils/logger';

export async function createNote({ title, body, category }: { title: string; body?: string; category: 'HAVE' | 'URGENT' | 'NICE' }) {
  await ContextsRepo.init()
  await NotesRepo.init()
  
  // Create note with pending classification status (no contextId assigned yet)
  const note = await NotesRepo.insert({ 
    title: title.trim(), 
    body: body?.trim() || undefined, 
    category,
    contextId: null, // Will be assigned by AI
  })
  
  logger.info('NOTE_CREATED', { noteId: note.id, title: note.title, status: 'pending' })
  
  // Add to Zustand store immediately for instant UI update
  useNotesStore.getState().addNote(note);
  
  // Fire-and-forget: AI classification happens in background
  classifyNoteAsync(note.id).catch(err => {
    logger.error('Classification failed (async)', { noteId: note.id, err })
  })
  
  return note
}
