import { ContextsRepo } from '../lib/db/contexts-repo'

describe('ContextsRepo basic', () => {
  test('init -> create -> list', async () => {
    await ContextsRepo.init()
    await ContextsRepo.createContexts(['A', 'B', 'C'])
    const list = await ContextsRepo.listContexts()
    expect(list.length).toBe(3)
    expect(list.map((i) => i.name)).toEqual(['A', 'B', 'C'])
  })
})