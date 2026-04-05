jest.mock('expo-sqlite')
jest.mock('expo-crypto')
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} }
  }
}))

// Mock the classification pipeline to prevent fire-and-forget async operations
jest.mock('../services/classification-pipeline', () => ({
  classifyNoteAsync: jest.fn().mockResolvedValue(undefined)
}))

import { createNote } from '../lib/services/note-creator'
import { logger } from '../lib/utils/logger'

describe('createNote integration', () => {
  beforeEach(() => {
    logger.clearLogs()
    process.env.EXPO_PUBLIC_AI_PLAN = 'free'
  })

  it('creates a note and emits logs', async () => {
    const note = await createNote({ title: 'Integration test', body: 'body', category: 'HAVE' })
    expect(note).toBeTruthy()
    expect(note.title).toBe('Integration test')
    expect(note.category).toBe('HAVE')
    expect(note.classificationStatus).toBe('manual')
    
    const logs = logger.getLogs((l) => l.message === 'NOTE_CREATED')
    expect(logs.length).toBeGreaterThanOrEqual(1)
    const noteCreated = logs.find((l) => l.message === 'NOTE_CREATED')
    expect(noteCreated?.meta?.noteId).toBe(note.id)
    expect(noteCreated?.meta?.status).toBe('manual')
  })
})
