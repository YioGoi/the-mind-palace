import { AssistantRunResult } from './service'
import { AssistantIntent, CleanupPlan } from './types'

export const CLEANUP_DEGRADED_MESSAGE =
  "Cleanup planning is temporarily unavailable right now. Nothing changed, and I didn't save this as a note."
export const CLEANUP_FAILURE_MESSAGE =
  "I couldn't generate a cleanup plan right now. Nothing changed in your Mind Palace."
export const CLEANUP_DISMISS_MESSAGE = 'Cleanup plan dismissed. Nothing changed.'
export const CLEANUP_EMPTY_SELECTION_MESSAGE = 'Select at least one cleanup action to apply.'

export function getInitialCleanupActionSelection(plan: CleanupPlan | null): number[] {
  if (!plan) return []
  return plan.actions.map((_, index) => index)
}

export function toggleCleanupActionSelection(current: number[], index: number): number[] {
  return current.includes(index)
    ? current.filter((value) => value !== index)
    : [...current, index].sort((a, b) => a - b)
}

export function buildSelectedCleanupPlan(plan: CleanupPlan, selectedIndexes: number[]): CleanupPlan {
  return {
    ...plan,
    actions: plan.actions.filter((_, index) => selectedIndexes.includes(index)),
  }
}

export function resolveAssistantOutcome(intent: AssistantIntent, result: AssistantRunResult) {
  if (!result.ok && result.degrade) {
    if (intent === 'cleanup') {
      return {
        kind: 'cleanup_degraded' as const,
        message: CLEANUP_DEGRADED_MESSAGE,
        shouldSaveNote: false,
      }
    }

    return {
      kind: 'capture_degraded' as const,
      message: 'AI planning is temporarily unavailable, but your note has been saved.',
      shouldSaveNote: true,
    }
  }

  if (!result.ok) {
    if (intent === 'cleanup') {
      return {
        kind: 'cleanup_failed' as const,
        message: CLEANUP_FAILURE_MESSAGE,
      }
    }

    return {
      kind: 'generic_failed' as const,
      message: "Sorry, I couldn't finish that request. Try rephrasing.",
    }
  }

  if (result.intent === 'cleanup') {
    if (result.result.actions.length === 0) {
      return {
        kind: 'cleanup_no_actions' as const,
        message: `${result.result.summary}\n\nI did not find any safe cleanup actions to suggest.`,
      }
    }

    return {
      kind: 'cleanup_review' as const,
      message: `${result.result.summary}\n\nReview the cleanup plan below, then confirm if you want me to apply it.`,
      plan: result.result,
    }
  }

  if (result.result.createdNotes.length === 0) {
    return {
      kind: 'capture_no_notes' as const,
      message: "Sorry, I couldn't find a note to create from that.",
    }
  }

  const summary = result.result.createdNotes.map((note) => `• ${note.title}`).join('\n')
  const listWord = result.result.createdNotes.length === 1 ? 'note' : 'notes'

  return {
    kind: 'capture_success' as const,
    message: `${result.result.summary}\n\nCreated ${result.result.createdNotes.length} ${listWord}:\n${summary}`,
    warnings: result.result.warnings,
  }
}
