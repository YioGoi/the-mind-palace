export const AI_FEATURES = ['context_assignment', 'assistant_capture', 'assistant_cleanup']
export const QUOTA_PROFILES = ['standard', 'test_low']
export const PLAN_LIMITS = {
  free: {
    standard: null,
    test_low: null,
  },
  premium: {
    standard: {
      monthlyInputTokens: 500_000,
      monthlyOutputTokens: 100_000,
      monthlyRequestCount: 200,
      requestsPerMinute: 5,
    },
    test_low: {
      monthlyInputTokens: 2_000,
      monthlyOutputTokens: 800,
      monthlyRequestCount: 2,
      requestsPerMinute: 2,
    },
  },
}

export function normalizeInstallId(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length >= 16 && normalized.length <= 128 ? normalized : null
}

export function isValidFeature(value) {
  return AI_FEATURES.includes(value)
}

export function isValidPlan(value) {
  return value === 'free' || value === 'premium'
}

export function isValidQuotaProfile(value) {
  return QUOTA_PROFILES.includes(value)
}

export function getPlanLimits(plan, quotaProfile = 'standard') {
  const profile = isValidQuotaProfile(quotaProfile) ? quotaProfile : 'standard'
  return PLAN_LIMITS[plan]?.[profile] ?? null
}

export function getCurrentPeriod(date = new Date()) {
  return date.toISOString().slice(0, 7)
}

export function getMinuteBucket(date = new Date()) {
  return date.toISOString().slice(0, 16)
}

export function createJsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
  })
}

export function createGatewayError(status, code, message, retryAfterSeconds) {
  return createJsonResponse({
    error: {
      code,
      message,
      retryAfterSeconds,
    },
  }, { status })
}

export function getOpenAiUsage(payload) {
  return {
    inputTokens: payload?.usage?.prompt_tokens ?? 0,
    outputTokens: payload?.usage?.completion_tokens ?? 0,
    totalTokens: payload?.usage?.total_tokens ?? 0,
  }
}
