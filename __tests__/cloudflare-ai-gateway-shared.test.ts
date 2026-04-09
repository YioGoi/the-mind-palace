import {
  AI_FEATURES,
  PLAN_LIMITS,
  getCurrentPeriod,
  getPlanLimits,
  getMinuteBucket,
  getOpenAiUsage,
  isValidFeature,
  isValidPlan,
  isValidQuotaProfile,
  normalizeInstallId,
} from '../cloudflare-ai-gateway/src/shared.js'

describe('cloudflare ai gateway shared helpers', () => {
  test('validates install ids and features', () => {
    expect(normalizeInstallId('  short  ')).toBeNull()
    expect(normalizeInstallId('1234567890abcdef')).toBe('1234567890abcdef')
    expect(isValidFeature('assistant_capture')).toBe(true)
    expect(isValidFeature('diagnostics')).toBe(false)
    expect(AI_FEATURES).toContain('context_assignment')
  })

  test('exposes balanced premium limits and time bucketing', () => {
    expect(PLAN_LIMITS.premium.standard).toEqual({
      monthlyInputTokens: 500000,
      monthlyOutputTokens: 100000,
      monthlyRequestCount: 200,
      requestsPerMinute: 5,
    })
    expect(PLAN_LIMITS.premium.test_low).toEqual({
      monthlyInputTokens: 2000,
      monthlyOutputTokens: 800,
      monthlyRequestCount: 2,
      requestsPerMinute: 2,
    })
    expect(getPlanLimits('premium', 'standard')).toEqual(PLAN_LIMITS.premium.standard)
    expect(getPlanLimits('premium', 'test_low')).toEqual(PLAN_LIMITS.premium.test_low)
    expect(getPlanLimits('free', 'standard')).toBeNull()
    expect(isValidQuotaProfile('standard')).toBe(true)
    expect(isValidQuotaProfile('test_low')).toBe(true)
    expect(isValidQuotaProfile('broken')).toBe(false)

    const date = new Date('2026-04-06T10:34:56.000Z')
    expect(getCurrentPeriod(date)).toBe('2026-04')
    expect(getMinuteBucket(date)).toBe('2026-04-06T10:34')
    expect(isValidPlan('premium')).toBe(true)
    expect(isValidPlan('enterprise')).toBe(false)
  })

  test('maps OpenAI usage into gateway counters', () => {
    expect(getOpenAiUsage({
      usage: {
        prompt_tokens: 120,
        completion_tokens: 40,
        total_tokens: 160,
      },
    })).toEqual({
      inputTokens: 120,
      outputTokens: 40,
      totalTokens: 160,
    })
  })
})
