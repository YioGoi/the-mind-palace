import { useThemeStore } from '../../app/store/theme-store'

export type AiPlan = 'free' | 'premium'

export function getAiPlan(): AiPlan {
  const devOverride = useThemeStore.getState().devAiPlanOverride
  if (__DEV__ && devOverride) {
    return devOverride
  }

  const raw = process.env.EXPO_PUBLIC_AI_PLAN?.trim().toLowerCase()
  return raw === 'premium' ? 'premium' : 'free'
}

export function isPremiumPlan(): boolean {
  return getAiPlan() === 'premium'
}

export function getAiGatewayUrl(): string | undefined {
  return process.env.EXPO_PUBLIC_AI_GATEWAY_URL ?? process.env.EXPO_PUBLIC_CONTEXT_ENGINE_URL
}

export function getPrimaryModel(): string {
  return process.env.EXPO_PUBLIC_AI_MODEL?.trim() || 'gpt-5-mini'
}

export function getFallbackModel(): string {
  return process.env.EXPO_PUBLIC_AI_FALLBACK_MODEL?.trim() || 'gpt-5-nano'
}
