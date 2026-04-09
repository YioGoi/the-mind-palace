import { logger } from '../lib/utils/logger'
import { getOrCreateInstallId } from '../lib/services/install-id'
import { AiGatewayFeature } from './ai/gateway-types'
import { getFallbackModel, getPrimaryModel } from './ai/config'

// ---------------------------------------------------------------------------
// PHASE 5 — Model config registry (single source of truth)
// ---------------------------------------------------------------------------
export type ModelConfig = {
  id: string
  label: string
  enabled: boolean
  priority: number   // lower = higher priority; used to sort within a chain
  timeoutMs: number
}

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: getPrimaryModel(),
    label: 'GPT-5 mini',
    enabled: true,
    priority: 1,
    timeoutMs: 25_000,
  },
  {
    id: getFallbackModel(),
    label: 'GPT-5 nano',
    enabled: true,
    priority: 2,
    timeoutMs: 15_000,
  },
]

// Convenience model-id constants  (matched by id, not array index — safe to reorder configs)
export const Models = {
  PRIMARY: getPrimaryModel(),
  FALLBACK: getFallbackModel(),
} as const

// Fallback chains (ordered by preference)
// GLM is the only confirmed-working model on Z.AI provider — put it first in both chains
export const AI_ASSISTANT_MODELS   = [Models.PRIMARY, Models.FALLBACK] as const
export const CONTEXT_ENGINE_MODELS = [Models.PRIMARY, Models.FALLBACK] as const

// ---------------------------------------------------------------------------
// PHASE 3 — Error type classification
// ---------------------------------------------------------------------------

/**
 * Retryable: worth trying the next model in the chain.
 * Non-retryable: a config/payload problem — trying another model won't fix it.
 */
export type ErrorType =
  | 'rate_limit'           // 429  — RETRYABLE
  | 'rate_limited'         // 429 from our gateway — NOT retryable
  | 'quota_exceeded'       // 429 from our gateway — NOT retryable
  | 'provider_unavailable' // 5xx or upstream error — RETRYABLE
  | 'timeout'              // network/AbortController timeout — RETRYABLE
  | 'auth_error'           // 401 / 403 — NOT retryable (fix config)
  | 'upgrade_required'     // 403 from our gateway — NOT retryable
  | 'bad_request'          // 400 — NOT retryable (fix payload)
  | 'parsing_error'        // 200 but can't extract content — NOT retryable
  | 'unknown'              // anything else — NOT retryable

const RETRYABLE_ERRORS: ErrorType[] = ['rate_limit', 'provider_unavailable', 'timeout']

export function isRetryable(e: ErrorType): boolean {
  return RETRYABLE_ERRORS.includes(e)
}

function classifyHttpError(status: number, body: string): { errorType: ErrorType; provider?: string } {
  let parsed: any = null
  try { parsed = JSON.parse(body) } catch { /* raw body */ }
  const provider: string | undefined = parsed?.error?.metadata?.provider_name ?? undefined
  const code = parsed?.error?.code
  if (status === 429 && code === 'rate_limited') return { errorType: 'rate_limited', provider }
  if (status === 429 && code === 'quota_exceeded') return { errorType: 'quota_exceeded', provider }
  if (status === 429) return { errorType: 'rate_limit', provider }
  if (status === 403 && code === 'upgrade_required') return { errorType: 'upgrade_required', provider }
  if (status === 401 || status === 403) return { errorType: 'auth_error', provider }
  if (status === 400) return { errorType: 'bad_request', provider }
  if (status >= 500) return { errorType: 'provider_unavailable', provider }
  return { errorType: 'unknown', provider }
}

// ---------------------------------------------------------------------------
// PHASE 1 — Structured result types
// ---------------------------------------------------------------------------
export type ModelCallSuccess = {
  success: true
  model: string
  label: string
  content: string
  latencyMs: number
}

export type ModelCallFailure = {
  success: false
  model: string
  label: string
  errorType: ErrorType
  status?: number
  code?: string
  provider?: string
  message: string
  latencyMs: number
  retryable: boolean
  retryAfterSeconds?: number
}

export class ModelRouterError extends Error {
  errorType: ErrorType
  status?: number
  code?: string
  retryAfterSeconds?: number

  constructor(params: {
    message: string
    errorType: ErrorType
    status?: number
    code?: string
    retryAfterSeconds?: number
  }) {
    super(params.message)
    this.name = 'ModelRouterError'
    this.errorType = params.errorType
    this.status = params.status
    this.code = params.code
    this.retryAfterSeconds = params.retryAfterSeconds
  }
}

export function isModelRouterError(error: unknown): error is ModelRouterError {
  return error instanceof ModelRouterError
}

export type ModelCallResult = ModelCallSuccess | ModelCallFailure

// ---------------------------------------------------------------------------
// PHASE 1 — Isolated single-model call (with timeout + full diagnostics)
// ---------------------------------------------------------------------------
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type ChatCompletionOptions = {
  timeoutMs?: number
  feature?: AiGatewayFeature
  responseFormat?: {
    type: 'json_schema'
    json_schema: {
      name: string
      schema: Record<string, unknown>
      strict: boolean
    }
  }
}

export async function callModel(
  endpoint: string,
  config: ModelConfig,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<ModelCallResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timeoutMs = options?.timeoutMs ?? config.timeoutMs
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const installId = await getOrCreateInstallId()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installId,
        feature: options?.feature ?? 'assistant_capture',
        model: config.id,
        messages,
        response_format: options?.responseFormat,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const latencyMs = Date.now() - start
    const body = await res.text()

    if (!res.ok) {
      const { errorType, provider } = classifyHttpError(res.status, body)
      let parsed: any = null
      try { parsed = JSON.parse(body) } catch { /* ignore */ }
      const code = parsed?.error?.code
      const retryAfterSeconds =
        typeof parsed?.error?.retryAfterSeconds === 'number' ? parsed.error.retryAfterSeconds : undefined
      // PHASE 2 — Human-readable log
      logger.warn(`ModelRouter ✗ [${config.label}] ${errorType.toUpperCase()}`, {
        model: config.id,
        status: res.status,
        code,
        errorType,
        provider,
        latencyMs,
        retryable: isRetryable(errorType),
        retryAfterSeconds,
        body: body.slice(0, 400),
      })
      return {
        success: false,
        model: config.id,
        label: config.label,
        errorType,
        status: res.status,
        code,
        provider,
        message: parsed?.error?.message ?? `HTTP ${res.status}: ${body.slice(0, 200)}`,
        latencyMs,
        retryable: isRetryable(errorType),
        retryAfterSeconds,
      }
    }

    // Parse OpenRouter chat-completion response
    let content: string | null = null
    try {
      const parsed = JSON.parse(body)
      content = parsed?.choices?.[0]?.message?.content ?? null
    } catch { /* body is not JSON */ }

    if (!content) {
      logger.warn(`ModelRouter ✗ [${config.label}] PARSING_ERROR`, {
        model: config.id,
        latencyMs,
        rawSnippet: body.slice(0, 200),
      })
      return {
        success: false,
        model: config.id,
        label: config.label,
        errorType: 'parsing_error',
        status: res.status,
        message: `Could not extract content from response: ${body.slice(0, 200)}`,
        latencyMs,
        retryable: false,
      }
    }

    logger.info(`ModelRouter ✓ [${config.label}] SUCCESS (${latencyMs}ms)`, {
      model: config.id,
      latencyMs,
      contentSnippet: content.slice(0, 100),
    })
    return { success: true, model: config.id, label: config.label, content, latencyMs }

  } catch (err) {
    clearTimeout(timer)
    const latencyMs = Date.now() - start
    const isTimeout = (err as Error)?.name === 'AbortError'
    const errorType: ErrorType = isTimeout ? 'timeout' : 'unknown'
    const message = isTimeout
      ? `Timed out after ${timeoutMs}ms`
      : (err instanceof Error ? err.message : String(err))

    logger.warn(`ModelRouter ✗ [${config.label}] ${isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR'}`, {
      model: config.id,
      errorType,
      latencyMs,
      message,
    })
    return { success: false, model: config.id, label: config.label, errorType, message, latencyMs, retryable: true }
  }
}

// ---------------------------------------------------------------------------
// PHASE 3 — Smart fallback (only retries on retryable errors)
// ---------------------------------------------------------------------------
export async function callWithFallback(
  endpoint: string,
  messages: ChatMessage[],
  models: readonly string[],
  options?: ChatCompletionOptions
): Promise<string> {
  // Resolve configs in chain order
  const configs = models
    .map(id => MODEL_CONFIGS.find(c => c.id === id && c.enabled))
    .filter((c): c is ModelConfig => c !== undefined)

  const results: ModelCallResult[] = []

  for (const config of configs) {
    // PHASE 2 — log attempt
    logger.info(`ModelRouter → trying [${config.label}]`, { model: config.id })

    const result = await callModel(endpoint, config, messages, options)
    results.push(result)

    if (result.success) return result.content

    if (!result.retryable) {
      // Non-retryable: stop the chain — changing model won't help
      logger.error(`ModelRouter ✗ STOPPING — non-retryable error from [${result.label}]`, {
        errorType: result.errorType,
        hint: result.errorType === 'auth_error'
          ? 'Check EXPO_PUBLIC_AI_GATEWAY_URL and API key config'
          : result.errorType === 'upgrade_required'
          ? 'User needs premium access on the AI gateway'
          : result.errorType === 'quota_exceeded'
          ? 'User has exhausted the monthly AI quota'
          : result.errorType === 'rate_limited'
          ? 'User hit a short-term AI rate limit'
          : result.errorType === 'bad_request'
          ? 'Check the request payload / prompt format'
          : 'Check model response format',
      })
      throw new ModelRouterError({
        message: `Non-retryable error (${result.errorType}) from ${result.label}: ${result.message}`,
        errorType: result.errorType,
        status: result.status,
        code: result.code,
        retryAfterSeconds: result.retryAfterSeconds,
      })
    }

    // Retryable: log and continue
    logger.info(`ModelRouter → [${result.label}] retryable (${result.errorType}), trying next model…`)
  }

  // All models exhausted
  const summary = results
    .map(r => `${r.label}:${r.success ? 'ok' : (r as ModelCallFailure).errorType}`)
    .join(' → ')
  logger.error(`ModelRouter ✗ ALL MODELS FAILED`, { summary })
  throw new Error(`All models failed. Chain: ${summary}`)
}

// ---------------------------------------------------------------------------
// PHASE 1 — Isolated probe (test one model with a minimal message)
// ---------------------------------------------------------------------------
export async function probeModel(
  endpoint: string,
  modelId: string,
  testMessage = 'Reply with the single word: OK'
): Promise<ModelCallResult> {
  const config = MODEL_CONFIGS.find(c => c.id === modelId)
  if (!config) {
    return {
      success: false,
      model: modelId,
      label: modelId,
      errorType: 'bad_request',
      message: `Model "${modelId}" not found in MODEL_CONFIGS`,
      latencyMs: 0,
      retryable: false,
    }
  }
  return callModel(endpoint, config, [{ role: 'user', content: testMessage }])
}

// ---------------------------------------------------------------------------
// PHASE 1 — Run diagnostic probe on all enabled models
// Call this from Settings screen or dev tools to check which models work
// ---------------------------------------------------------------------------
export async function runDiagnostics(endpoint: string): Promise<ModelCallResult[]> {
  logger.info('ModelRouter DIAGNOSTICS start', {
    endpoint,
    models: MODEL_CONFIGS.filter(c => c.enabled).map(c => c.label),
  })
  const results: ModelCallResult[] = []

  for (const config of MODEL_CONFIGS.filter(c => c.enabled)) {
    logger.info(`ModelRouter DIAGNOSTICS probing [${config.label}]…`)
    const result = await probeModel(endpoint, config.id)
    results.push(result)
    if (result.success) {
      logger.info(`  ✓ ${config.label} reachable (${result.latencyMs}ms)`)
    } else {
      const f = result as ModelCallFailure
      logger.warn(`  ✗ ${config.label} → ${f.errorType} | retryable=${f.retryable} | provider=${f.provider ?? 'unknown'}`)
    }
  }

  const working = results.filter(r => r.success).map(r => r.label)
  const failing = results.filter(r => !r.success).map(r => {
    const f = r as ModelCallFailure
    return `${r.label}(${f.errorType}${f.provider ? '/' + f.provider : ''})`
  })
  logger.info('ModelRouter DIAGNOSTICS complete', { working, failing })
  return results
}
