import { ContextsRepo } from '../app/db/contexts-repo'
import { FeedbackRepo } from '../app/db/feedback-repo'
import { NotesRepo } from '../app/db/notes-repo'
import { useNotesStore } from '../app/store/notes-store'
import { logger } from '../app/utils/logger'
import { callContextEngineAPI } from './context-engine/client'
import { classifyContextService } from './context-engine/service'

// Helper to wrap and log OpenRouter API call
import type { Context, NoteInput, UserFeedback } from './context-engine/types'

async function callContextEngineAPIWithLogging(
  note: NoteInput,
  contexts: Context[],
  feedback: UserFeedback,
  userMessage: string
) {
  logger.info('OpenRouter API call: payload', { note, contexts, feedback, userMessage });
  try {
    const result = await callContextEngineAPI(note, contexts, feedback, userMessage);
    logger.info('OpenRouter API call: response', { result });
    return result;
  } catch (err) {
    logger.error('OpenRouter API call: error', { error: err });
    throw err;
  }
}
export async function classifyNoteAsync(noteId: string) {
  logger.info('Classification pipeline invoked', { noteId });
  // Fetch note and contexts
  const note = await NotesRepo.getById(noteId);
  logger.info('Fetched note for classification', { noteId, note });
  if (!note) {
    logger.error('Note not found for classification', { noteId });
    return;
  }
  const contexts = await ContextsRepo.listContexts();
  logger.info('Fetched contexts for classification', { noteId, contextCount: contexts.length, contexts });
  
  // Fetch recent user feedback to improve AI accuracy
  const recentFeedback = await FeedbackRepo.getRecentFeedback(50);
  const formattedFeedback: UserFeedback = recentFeedback.map(fb => ({
    contextId: fb.userChosenContextId,
    feedback: fb.feedback
  }));
  logger.info('Fetched user feedback for classification', { 
    noteId, 
    feedbackCount: formattedFeedback.length,
    correctCount: formattedFeedback.filter(f => f.feedback === 'correct').length,
    incorrectCount: formattedFeedback.filter(f => f.feedback === 'incorrect').length
  });
  
  try {
    logger.info('Classification started', { noteId });
    const modelCall = (userMessage: string) => {
      logger.info('Calling context engine API', { noteId, userMessage });
      return callContextEngineAPIWithLogging(note, contexts, formattedFeedback, userMessage);
    };
    const result = await classifyContextService(note, contexts, formattedFeedback, modelCall);
    logger.info('Classification service result', { noteId, result });
    if (result.type === 'assign') {
      if (note && NotesRepo && typeof NotesRepo.updateClassification === 'function') {
        await NotesRepo.updateClassification(noteId, result.contextId, 'assigned');
        
        // Update Zustand store
        useNotesStore.getState().updateNoteClassification(noteId, result.contextId, 'assigned');
        
        logger.info('Classification assigned', { noteId, contextId: result.contextId });
      } else {
        logger.error('DB not ready for classification update', { noteId, result });
      }
    } else if (result.type === 'propose') {
      // AI proposed a new context - create it and assign the note
      logger.info('AI proposed new context', { noteId, proposedName: result.proposedContext, category: note.category });
      
      await ContextsRepo.createContexts([result.proposedContext], note.category);
      const allContexts = await ContextsRepo.listContexts();
      const newContext = allContexts.find(c => c.name === result.proposedContext && c.category === note.category);
      
      if (!newContext) {
        logger.error('Failed to find newly created context', { noteId, proposedName: result.proposedContext });
        throw new Error('Failed to create new context');
      }
      
      logger.info('Created new context from AI proposal', { noteId, contextId: newContext.id, name: newContext.name });
      
      // Add new context to store
      useNotesStore.getState().addContext(newContext);
      
      if (note && NotesRepo && typeof NotesRepo.updateClassification === 'function') {
        await NotesRepo.updateClassification(noteId, newContext.id, 'assigned');
        
        // Update Zustand store
        useNotesStore.getState().updateNoteClassification(noteId, newContext.id, 'assigned');
        
        logger.info('Classification assigned to new context', { noteId, contextId: newContext.id });
      } else {
        logger.error('DB not ready for classification update', { noteId, result });
      }
    } else {
      logger.error('Unknown classification result type', { noteId, result });
    }
    return result;
  } catch (e) {
    let errorMsg = '';
    if (e instanceof Error) {
      errorMsg = e.message;
    } else if (typeof e === 'string') {
      errorMsg = e;
    } else {
      errorMsg = JSON.stringify(e);
    }
    logger.error('Classification failed', { noteId, error: errorMsg });
    if (note && NotesRepo && typeof NotesRepo.updateClassification === 'function') {
      await NotesRepo.updateClassification(noteId, null, 'error');
      
      // Update Zustand store
      useNotesStore.getState().updateNoteClassification(noteId, null, 'error');
    } else {
      logger.error('DB not ready for error classification update', { noteId, error: errorMsg });
    }
    return { error: errorMsg };
  }
}
