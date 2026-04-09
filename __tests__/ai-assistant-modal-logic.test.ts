import {
  buildSelectedCleanupPlan,
  AI_QUOTA_EXCEEDED_MESSAGE,
  AI_RATE_LIMITED_MESSAGE,
  AI_UPGRADE_REQUIRED_MESSAGE,
  CLEANUP_DEGRADED_MESSAGE,
  CLEANUP_DISMISS_MESSAGE,
  CLEANUP_EMPTY_SELECTION_MESSAGE,
  getInitialCleanupActionSelection,
  resolveAssistantOutcome,
  toggleCleanupActionSelection,
} from '../services/ai-assistant/modal-logic'
import { CleanupPlan } from '../services/ai-assistant/types'

const sampleCleanupPlan: CleanupPlan = {
  summary: 'Tidy up a few safe items.',
  actions: [
    { type: 'delete_empty_context', contextId: 'ctx-1', reason: 'Safe.' },
    { type: 'rename_context', contextId: 'ctx-2', newName: 'Renamed', reason: 'Clearer.' },
  ],
}

describe('AI assistant modal logic', () => {
  test('cleanup timeout degrades to a warning without saving a note', () => {
    const outcome = resolveAssistantOutcome('cleanup', {
      ok: false,
      degrade: true,
      reason: 'all_models_failed',
    })

    expect(outcome).toEqual({
      kind: 'cleanup_degraded',
      message: CLEANUP_DEGRADED_MESSAGE,
      shouldSaveNote: false,
    })
  })

  test('cleanup review starts with all actions selected and can filter to apply selected only', () => {
    const initialSelection = getInitialCleanupActionSelection(sampleCleanupPlan)
    const afterToggle = toggleCleanupActionSelection(initialSelection, 1)
    const selectedPlan = buildSelectedCleanupPlan(sampleCleanupPlan, afterToggle)

    expect(initialSelection).toEqual([0, 1])
    expect(afterToggle).toEqual([0])
    expect(selectedPlan.actions).toEqual([sampleCleanupPlan.actions[0]])
    expect(CLEANUP_EMPTY_SELECTION_MESSAGE).toBe('Select at least one cleanup action to apply.')
  })

  test('canceling cleanup uses the nothing changed message', () => {
    expect(CLEANUP_DISMISS_MESSAGE).toBe('Cleanup plan dismissed. Nothing changed.')
  })

  test('upgrade and quota errors map to explicit user-facing messages', () => {
    expect(resolveAssistantOutcome('capture', {
      ok: false,
      degrade: false,
      reason: 'upgrade_required',
    })).toEqual({
      kind: 'upgrade_required',
      message: AI_UPGRADE_REQUIRED_MESSAGE,
    })

    expect(resolveAssistantOutcome('capture', {
      ok: false,
      degrade: false,
      reason: 'quota_exceeded',
    })).toEqual({
      kind: 'quota_exceeded',
      message: AI_QUOTA_EXCEEDED_MESSAGE,
    })

    expect(resolveAssistantOutcome('cleanup', {
      ok: false,
      degrade: false,
      reason: 'rate_limited',
    })).toEqual({
      kind: 'rate_limited',
      message: AI_RATE_LIMITED_MESSAGE,
    })
  })

  test('capture with no notes uses the assistant summary instead of a generic error', () => {
    expect(resolveAssistantOutcome('capture', {
      ok: true,
      intent: 'capture',
      result: {
        createdNotes: [],
        operationLog: [],
        summary: 'I can help you turn brain dumps into notes, split mixed messages, and highlight time-sensitive items.',
        warnings: [],
      },
    })).toEqual({
      kind: 'capture_no_notes',
      message: 'I can help you turn brain dumps into notes, split mixed messages, and highlight time-sensitive items.',
    })
  })

  test('capture success prefers concise operation reporting', () => {
    expect(resolveAssistantOutcome('capture', {
      ok: true,
      intent: 'capture',
      result: {
        createdNotes: [{ id: 'n1', title: 'Doctor' }],
        operationLog: ['Saved "Doctor" as urgent. Time: Apr 09, 17:00.'],
        summary: 'I split this into one time-sensitive note so it is easier to act on.',
        warnings: [],
      },
    })).toEqual({
      kind: 'capture_success',
      message: 'I split this into one time-sensitive note so it is easier to act on.\n\nWhat I handled:\n• Saved "Doctor" as urgent. Time: Apr 09, 17:00.',
      warnings: [],
    })
  })
})
