import { ContextsRepo } from '../lib/db/contexts-repo'
import { FeedbackRepo } from '../lib/db/feedback-repo'
import { NotesRepo } from '../lib/db/notes-repo'
import { useNoteUiHintsStore } from '../lib/store/note-ui-hints-store'
import { useNotesStore } from '../lib/store/notes-store'
import { logger } from '../lib/utils/logger'
import { callContextEngineAPI } from './context-engine/client'
import { classifyContextService } from './context-engine/service'
import { isModelRouterError } from './model-router'

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
    if (isModelRouterError(err) && (err.errorType === 'quota_exceeded' || err.errorType === 'rate_limited')) {
      logger.warn('OpenRouter API call: handled limit', {
        errorType: err.errorType,
        message: err.message,
      });
    } else {
      logger.error('OpenRouter API call: error', { error: err });
    }
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
  const allContexts = await ContextsRepo.listContexts();
  const contexts = allContexts.filter(context => context.category === note.category);
  logger.info('Fetched contexts for classification', {
    noteId,
    totalContextCount: allContexts.length,
    filteredContextCount: contexts.length,
    noteCategory: note.category,
    contexts,
  });
  
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
      const assignedContext = contexts.find(context => context.id === result.contextId)
      if (!assignedContext) {
        logger.error('Classification returned context outside note category', {
          noteId,
          noteCategory: note.category,
          contextId: result.contextId,
        })
        throw new Error('Classification returned invalid context for note category')
      }

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
    let handledLimit = false;
    if (e instanceof Error) {
      errorMsg = e.message;
    } else if (typeof e === 'string') {
      errorMsg = e;
    } else {
      errorMsg = JSON.stringify(e);
    }

    if (isModelRouterError(e) && (e.errorType === 'quota_exceeded' || e.errorType === 'rate_limited')) {
      handledLimit = true
      useNoteUiHintsStore.getState().showUnsortedAiNotice(
        note.category,
        e.errorType === 'quota_exceeded'
          ? 'AI quota reached. New notes will stay in Unsorted for now.'
          : 'AI is busy right now. New notes may stay in Unsorted for now.'
      )
    }

    if (handledLimit) {
      logger.warn('Classification handled fallback', { noteId, error: errorMsg })
    } else {
      logger.error('Classification failed', { noteId, error: errorMsg });
    }

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

/**
 * Re-queue any notes that are stuck in 'pending' classification status.
 * Called on cold start and app resume to recover from interrupted classifications.
 */
export async function reclassifyPendingNotes(): Promise<void> {
  try {
    await NotesRepo.init()
    const allNotes = await NotesRepo.listAll()
    const pending = allNotes.filter(n => n.classificationStatus === 'pending')

    if (pending.length === 0) return

    logger.info('Reclassifying pending notes on startup', { count: pending.length })

    // Stagger calls 1500ms apart to avoid a retry storm hitting rate limits simultaneously
    for (let i = 0; i < pending.length; i++) {
      const note = pending[i]
      if (i > 0) await new Promise(r => setTimeout(r, 1500))
      classifyNoteAsync(note.id).catch(err =>
        logger.error('Reclassify failed for pending note', { noteId: note.id, err })
      )
    }
  } catch (e) {
    logger.error('reclassifyPendingNotes failed', { err: e })
  }
}
