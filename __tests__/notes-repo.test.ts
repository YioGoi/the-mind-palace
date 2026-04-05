jest.mock('expo-sqlite')
jest.mock('expo-crypto')
import { NotesRepo } from '../lib/db/notes-repo'

describe('NotesRepo basic', () => {
  test('init -> insert -> getById', async () => {
    await NotesRepo.init()
    
    const note = await NotesRepo.insert({
      title: 'Test note',
      body: 'hello',
      category: 'HAVE',
    })
    
    expect(note.id).toBeTruthy()
    expect(note.title).toBe('Test note')
    expect(note.classificationStatus).toBe('manual')
    
    const got = await NotesRepo.getById(note.id)
    expect(got).not.toBeNull()
    expect(got?.id).toBe(note.id)
    expect(got?.title).toBe('Test note')
  })

  test('updateClassification', async () => {
    const note = await NotesRepo.insert({
      title: 'Another note',
      category: 'URGENT',
      classificationStatus: 'pending',
    })
    
    await NotesRepo.updateClassification(note.id, 'context-123', 'assigned')
    
    // Give DB time to commit
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const got = await NotesRepo.getById(note.id)
    expect(got?.contextId).toBe('context-123')
    expect(got?.classificationStatus).toBe('assigned')
  })
})
