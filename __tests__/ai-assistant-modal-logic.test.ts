import {
  buildSelectedCleanupPlan,
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
})
