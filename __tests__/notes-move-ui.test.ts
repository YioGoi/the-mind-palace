jest.mock('expo-sqlite')
import { ContextsRepo } from '../app/db/contexts-repo'
import { NotesRepo } from '../app/db/notes-repo'

describe('Notes move UI-level test', () => {
  test('moveNoteToContext returns previous null and logs AI_FEEDBACK', async () => {
    await ContextsRepo.init()
    await NotesRepo.init()

    // create context and note
    await ContextsRepo.createContexts(['Target'])
    const ctxs = await ContextsRepo.listContexts()
    const target = ctxs.find((c) => c.name === 'Target')!
    expect(target).toBeTruthy()

    const note = await NotesRepo.insert({
      title: 'No context note',
      category: 'HAVE',
    })

    // spy console logs (logger uses console.log)
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})

    const previous = await NotesRepo.moveNoteToContext(note.id, target.id)
    expect(previous).toBeNull()

    const calls = spy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(calls).toMatch(/"action"\s*:\s*"move"/)
    expect(calls).toMatch(new RegExp(`"newContextId"\\s*:\\s*"${target.id}"`))

    spy.mockRestore()
  })
})