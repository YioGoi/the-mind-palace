import { logger } from '../lib/utils/logger'

describe('logger buffer', () => {
  beforeEach(() => {
    logger.clearLogs()
  })

  it('stores logs in memory and can be queried', () => {
    logger.info('TEST_LOG', { foo: 'bar' })
    const logs = logger.getLogs((l) => l.message === 'TEST_LOG')
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[logs.length - 1].meta).toMatchObject({ foo: 'bar' })
  })

  it('safely logs Error objects without throwing and preserves Error in buffer', () => {
    const err = new Error('boom')
    logger.error('ERR_TEST', { err })
    const logs = logger.getLogs((l) => l.message === 'ERR_TEST')
    expect(logs.length).toBeGreaterThan(0)
    const last = logs[logs.length - 1]
    expect(last.meta).toBeTruthy()
    expect(last.meta.err).toBeInstanceOf(Error)
    expect(last.meta.err.message).toBe('boom')
  })
})
