import { parseContextEngineOutput } from '../parser'

describe('parseContextEngineOutput', () => {
  it('parses assign output', () => {
    const raw = JSON.stringify({ type: 'assign', contextId: 'abc123' })
    expect(parseContextEngineOutput(raw)).toEqual({ type: 'assign', contextId: 'abc123' })
  })
  it('parses propose output', () => {
    const raw = JSON.stringify({ type: 'propose', proposedContext: 'Travel' })
    expect(parseContextEngineOutput(raw)).toEqual({ type: 'propose', proposedContext: 'Travel' })
  })
  it('throws on invalid JSON', () => {
    expect(() => parseContextEngineOutput('not json')).toThrow()
  })
  it('throws on schema mismatch', () => {
    expect(() => parseContextEngineOutput(JSON.stringify({ foo: 'bar' }))).toThrow()
  })
})
