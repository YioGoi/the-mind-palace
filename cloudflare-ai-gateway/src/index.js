import {
  createGatewayError,
  createJsonResponse,
  getPlanLimits,
  getCurrentPeriod,
  getMinuteBucket,
  getOpenAiUsage,
  isValidFeature,
  isValidPlan,
  isValidQuotaProfile,
  normalizeInstallId,
} from './shared.js'

async function ensureUser(env, installId) {
  const now = new Date().toISOString()
  await env.AI_DB.prepare(`
    INSERT INTO users (install_id, plan, quota_profile, created_at, updated_at)
    VALUES (?, 'free', 'standard', ?, ?)
    ON CONFLICT(install_id) DO NOTHING
  `).bind(installId, now, now).run()

  return env.AI_DB.prepare(`
    SELECT install_id, plan, quota_profile, created_at, updated_at
    FROM users
    WHERE install_id = ?
    LIMIT 1
  `).bind(installId).first()
}

async function getMonthlyUsage(env, installId, period) {
  return env.AI_DB.prepare(`
    SELECT request_count, input_tokens, output_tokens, total_tokens, updated_at
    FROM monthly_usage
    WHERE install_id = ? AND period = ?
    LIMIT 1
  `).bind(installId, period).first()
}

async function checkRateLimit(env, installId, requestsPerMinute) {
  const minuteBucket = getMinuteBucket()
  const key = `rate:${installId}:${minuteBucket}`
  const current = Number((await env.RATE_LIMIT_KV.get(key)) ?? '0')

  if (current >= requestsPerMinute) {
    return createGatewayError(
      429,
      'rate_limited',
      'AI is getting too many requests right now. Please try again shortly.',
      60
    )
  }

  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 120 })
  return null
}

async function recordUsage(env, params) {
  const {
    installId,
    feature,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    status,
  } = params

  const now = new Date().toISOString()
  const period = getCurrentPeriod()

  await env.AI_DB.prepare(`
    INSERT INTO usage_logs (
      id, install_id, feature, model, input_tokens, output_tokens, total_tokens, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    installId,
    feature,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    status,
    now
  ).run()

  if (status !== 'success') return

  await env.AI_DB.prepare(`
    INSERT INTO monthly_usage (
      install_id, period, request_count, input_tokens, output_tokens, total_tokens, updated_at
    )
    VALUES (?, ?, 1, ?, ?, ?, ?)
    ON CONFLICT(install_id, period) DO UPDATE SET
      request_count = request_count + 1,
      input_tokens = input_tokens + excluded.input_tokens,
      output_tokens = output_tokens + excluded.output_tokens,
      total_tokens = total_tokens + excluded.total_tokens,
      updated_at = excluded.updated_at
  `).bind(
    installId,
    period,
    inputTokens,
    outputTokens,
    totalTokens,
    now
  ).run()
}

async function handleChat(request, env) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return createGatewayError(400, 'bad_request', 'Request body must be valid JSON.')
  }

  const installId = normalizeInstallId(payload?.installId)
  const feature = payload?.feature
  const model = typeof payload?.model === 'string' ? payload.model : null
  const messages = Array.isArray(payload?.messages) ? payload.messages : null
  const responseFormat = payload?.response_format

  if (!installId) {
    return createGatewayError(400, 'bad_request', 'installId is required.')
  }
  if (!isValidFeature(feature)) {
    return createGatewayError(400, 'bad_request', 'feature is required.')
  }
  if (!model || !messages) {
    return createGatewayError(400, 'bad_request', 'model and messages are required.')
  }

  console.log('AI gateway request', {
    installId,
    feature,
    model,
    messageCount: messages.length,
    hasResponseFormat: Boolean(responseFormat),
  })

  const user = await ensureUser(env, installId)
  if (!user || !isValidPlan(user.plan)) {
    return createGatewayError(500, 'user_state_invalid', 'AI user state is invalid.')
  }

  if (user.plan !== 'premium') {
    return createGatewayError(403, 'upgrade_required', 'Premium access is required for this AI feature.')
  }

  const quotaProfile = isValidQuotaProfile(user.quota_profile) ? user.quota_profile : 'standard'
  const limits = getPlanLimits(user.plan, quotaProfile)
  const rateLimitResponse = await checkRateLimit(env, installId, limits.requestsPerMinute)
  if (rateLimitResponse) return rateLimitResponse

  const period = getCurrentPeriod()
  const usage = await getMonthlyUsage(env, installId, period)
  const currentRequestCount = Number(usage?.request_count ?? 0)
  const currentInputTokens = Number(usage?.input_tokens ?? 0)
  const currentOutputTokens = Number(usage?.output_tokens ?? 0)

  if (
    currentRequestCount >= limits.monthlyRequestCount ||
    currentInputTokens >= limits.monthlyInputTokens ||
    currentOutputTokens >= limits.monthlyOutputTokens
  ) {
    return createGatewayError(429, 'quota_exceeded', "You've reached your monthly AI usage limit.")
  }

  const upstreamResponse = await fetch(env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: responseFormat,
    }),
  })

  const text = await upstreamResponse.text()

  if (!upstreamResponse.ok) {
    console.log('OpenAI upstream error', {
      installId,
      feature,
      model,
      status: upstreamResponse.status,
      bodySnippet: text.slice(0, 1000),
    })

    await recordUsage(env, {
      installId,
      feature,
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      status: `upstream_${upstreamResponse.status}`,
    })

    return createGatewayError(
      upstreamResponse.status >= 500 ? 503 : upstreamResponse.status,
      'upstream_error',
      'AI upstream request failed.'
    )
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    console.log('OpenAI upstream parse error', {
      installId,
      feature,
      model,
      bodySnippet: text.slice(0, 1000),
    })

    await recordUsage(env, {
      installId,
      feature,
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      status: 'parse_error',
    })

    return createGatewayError(502, 'upstream_parse_error', 'AI upstream response could not be parsed.')
  }

  const { inputTokens, outputTokens, totalTokens } = getOpenAiUsage(parsed)

  console.log('OpenAI upstream success', {
    installId,
    feature,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
  })

  await recordUsage(env, {
    installId,
    feature,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    status: 'success',
  })

  return new Response(text, {
    status: upstreamResponse.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

async function handleUsage(request, env) {
  const url = new URL(request.url)
  const installId = normalizeInstallId(url.searchParams.get('installId'))
  if (!installId) {
    return createGatewayError(400, 'bad_request', 'installId is required.')
  }

  const user = await ensureUser(env, installId)
  const period = getCurrentPeriod()
  const usage = await getMonthlyUsage(env, installId, period)

  return createJsonResponse({
    installId,
    plan: user?.plan ?? 'free',
    quotaProfile: user?.quota_profile ?? 'standard',
    period,
    limits: getPlanLimits(user?.plan ?? 'free', user?.quota_profile ?? 'standard'),
    usage: {
      requestCount: Number(usage?.request_count ?? 0),
      inputTokens: Number(usage?.input_tokens ?? 0),
      outputTokens: Number(usage?.output_tokens ?? 0),
      totalTokens: Number(usage?.total_tokens ?? 0),
    },
  })
}

async function handleAdminPlan(request, env) {
  const secret = request.headers.get('x-admin-secret')
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return createGatewayError(401, 'unauthorized', 'Admin secret is required.')
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return createGatewayError(400, 'bad_request', 'Request body must be valid JSON.')
  }

  const installId = normalizeInstallId(payload?.installId)
  const plan = payload?.plan
  const quotaProfile = payload?.quotaProfile ?? 'standard'
  if (!installId || !isValidPlan(plan) || !isValidQuotaProfile(quotaProfile)) {
    return createGatewayError(400, 'bad_request', 'installId, a valid plan, and a valid quotaProfile are required.')
  }

  const now = new Date().toISOString()
  await env.AI_DB.prepare(`
    INSERT INTO users (install_id, plan, quota_profile, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(install_id) DO UPDATE SET
      plan = excluded.plan,
      quota_profile = excluded.quota_profile,
      updated_at = excluded.updated_at
  `).bind(installId, plan, quotaProfile, now, now).run()

  return createJsonResponse({ installId, plan, quotaProfile, updatedAt: now })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'POST' && (url.pathname === '/api/ai/chat' || url.pathname === '/api/ai')) {
      return handleChat(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/api/ai/usage') {
      return handleUsage(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/api/admin/users/plan') {
      return handleAdminPlan(request, env)
    }

    return createGatewayError(404, 'not_found', 'Route not found.')
  },
}
