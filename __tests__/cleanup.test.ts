jest.mock('expo-sqlite')
jest.mock('expo-crypto')

const mockCallAiAssistant = jest.fn()

jest.mock('../services/ai-assistant/client', () => ({
  callAiAssistant: (...args: unknown[]) => mockCallAiAssistant(...args),
}))

import { getDb } from '../lib/db/database'
import { ContextsRepo } from '../lib/db/contexts-repo'
import { FeedbackRepo } from '../lib/db/feedback-repo'
import { NotesRepo } from '../lib/db/notes-repo'
import { logger } from '../lib/utils/logger'
import { applyCleanupPlan, planCleanup } from '../services/ai-assistant/cleanup'

describe('cleanup planner', () => {
  beforeEach(async () => {
    mockCallAiAssistant.mockReset()
    logger.clearLogs()

    await Promise.all([ContextsRepo.init(), NotesRepo.init(), FeedbackRepo.init()])
    const db = getDb() as { __tables?: Record<string, { rows: unknown[] }> }
    for (const table of Object.values(db.__tables ?? {})) {
      table.rows.length = 0
    }
  })

  test('planCleanup filters out moves into generic contexts', async () => {
    const genericContext = await ContextsRepo.createContext('New', 'NICE')
    const unsorted = await NotesRepo.insert({
      title: 'Passport thought',
      category: 'NICE',
      classificationStatus: 'manual',
    })

    mockCallAiAssistant.mockResolvedValue(
      JSON.stringify({
        summary: 'Try moving into a vague bucket.',
        actions: [
          {
            type: 'move_notes',
            noteIds: [unsorted.id],
            targetContextId: genericContext.id,
            reason: 'Move the unsorted note into the generic context.',
          },
        ],
      })
    )

    const plan = await planCleanup('Organize, clean up and plan my notes and contexts')

    expect(plan.actions).toEqual([])
    expect(plan.summary).toBe('Try moving into a vague bucket.')
  })

  test('planCleanup keeps create_context_and_move_notes for unsorted notes', async () => {
    const contextName = `Passport / ID renewals ${Date.now()}`
    const unsorted = await NotesRepo.insert({
      title: 'Renew passport',
      category: 'HAVE',
      classificationStatus: 'manual',
    })
    expect((await NotesRepo.listAll()).some((note) => note.id === unsorted.id)).toBe(true)

    mockCallAiAssistant.mockResolvedValue(
      JSON.stringify({
        summary: 'Create a specific context for the passport task.',
        actions: [
          {
            type: 'create_context_and_move_notes',
            noteIds: [unsorted.id],
            category: 'HAVE',
            contextName,
            reason: 'The unsorted note is clearly about passport renewal.',
          },
        ],
      })
    )

    const plan = await planCleanup('Organize, clean up and plan my notes and contexts')

    expect(plan.actions).toEqual([
      {
        type: 'create_context_and_move_notes',
        noteIds: [unsorted.id],
        category: 'HAVE',
        contextName,
        reason: 'The unsorted note is clearly about passport renewal.',
      },
    ])
  })

  test('applyCleanupPlan creates a context and moves eligible unsorted notes into it', async () => {
    const contextName = `Passport / ID renewals ${Date.now()}`
    const first = await NotesRepo.insert({
      title: 'Renew passport',
      category: 'HAVE',
      classificationStatus: 'manual',
    })
    const second = await NotesRepo.insert({
      title: 'Renew ID card',
      category: 'HAVE',
      classificationStatus: 'manual',
    })

    const result = await applyCleanupPlan({
      summary: 'Create a document renewal bucket.',
      actions: [
        {
          type: 'create_context_and_move_notes',
          noteIds: [first.id, second.id],
          category: 'HAVE',
          contextName,
          reason: 'These unsorted notes are clearly about renewing official documents.',
        },
      ],
    })

    const contexts = await ContextsRepo.listContexts()
    const created = contexts.find((context) => context.name === contextName)
    const notes = await NotesRepo.listAll()
    const updatedFirst = notes.find((note) => note.id === first.id)
    const updatedSecond = notes.find((note) => note.id === second.id)

    expect(created).toBeTruthy()
    expect(updatedFirst?.contextId).toBe(created?.id)
    expect(updatedSecond?.contextId).toBe(created?.id)
    expect(result.appliedCount).toBe(1)
    expect(result.skippedCount).toBe(0)
    expect(result.details).toContain(`Created "${contextName}" and moved 2 notes into it.`)
  })
})
