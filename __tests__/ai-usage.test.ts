import { buildAiUsageUrl, formatUsageProgress } from '../lib/utils/ai-usage'

describe('ai usage helpers', () => {
  test('builds usage endpoint from chat gateway url', () => {
    expect(
      buildAiUsageUrl(
        'https://mind-palace-ai-gateway.ydogan-dev.workers.dev/api/ai/chat',
        'install-123'
      )
    ).toBe('https://mind-palace-ai-gateway.ydogan-dev.workers.dev/api/ai/usage?installId=install-123')
  })

  test('formats usage progress safely', () => {
    expect(formatUsageProgress(12, 50)).toBe('12 / 50')
    expect(formatUsageProgress(12, null)).toBe('12')
    expect(formatUsageProgress(12, 0)).toBe('12')
  })
})
