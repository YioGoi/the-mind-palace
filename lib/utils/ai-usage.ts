export type AiRemoteUsage = {
  installId: string
  plan: 'free' | 'premium'
  quotaProfile: 'standard' | 'test_low'
  period: string
  limits: {
    monthlyInputTokens: number
    monthlyOutputTokens: number
    monthlyRequestCount: number
    requestsPerMinute: number
  } | null
  usage: {
    requestCount: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export function buildAiUsageUrl(gatewayUrl: string, installId: string): string {
  const url = new URL(gatewayUrl)
  url.pathname = '/api/ai/usage'
  url.search = ''
  url.searchParams.set('installId', installId)
  return url.toString()
}

export async function fetchAiRemoteUsage(gatewayUrl: string, installId: string): Promise<AiRemoteUsage> {
  const response = await fetch(buildAiUsageUrl(gatewayUrl, installId))
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Usage endpoint failed (${response.status}): ${text.slice(0, 200)}`)
  }

  return JSON.parse(text) as AiRemoteUsage
}

export function formatUsageProgress(current: number, limit: number | null | undefined): string {
  if (!limit || limit <= 0) return String(current)
  return `${current} / ${limit}`
}
