import { CONTEXT_ENGINE_PROMPT } from '../prompt'

describe('CONTEXT_ENGINE_PROMPT', () => {
  it('matches snapshot', () => {
    expect(CONTEXT_ENGINE_PROMPT).toMatchSnapshot()
  })
})
