import { useThemeStore } from '../../lib/store/theme-store'

export type AiPlan = 'free' | 'premium'
export type AiEntitlementChannel = 'dev_override' | 'env_fallback'
export type AiEntitlement = {
  plan: AiPlan
  hasPremiumAccess: boolean
  channel: AiEntitlementChannel
  isTestOverride: boolean
}

export type AiCapabilities = {
  entitlement: AiEntitlement
  premiumEnabled: boolean
  canAutoClassifyNotes: boolean
  canUseAssistantPlanner: boolean
  assistantFallbackMode: 'plain_note_capture'
  marketingEnabled: boolean
}

function getEnvAiPlan(): AiPlan {
  const raw = process.env.EXPO_PUBLIC_AI_PLAN?.trim().toLowerCase()
  return raw === 'premium' ? 'premium' : 'free'
}

export function getAiEntitlement(): AiEntitlement {
  const devOverride = useThemeStore.getState().devAiPlanOverride
  if (__DEV__ && devOverride) {
    return {
      plan: devOverride,
      hasPremiumAccess: devOverride === 'premium',
      channel: 'dev_override',
      isTestOverride: true,
    }
  }

  const plan = getEnvAiPlan()
  return {
    plan,
    hasPremiumAccess: plan === 'premium',
    channel: 'env_fallback',
    isTestOverride: false,
  }
}

export function getAiPlan(): AiPlan {
  return getAiEntitlement().plan
}

export function isPremiumPlan(): boolean {
  return getAiEntitlement().hasPremiumAccess
}

export function hasAiUpsellMarketingEnabled(): boolean {
  return !getAiEntitlement().isTestOverride
}

export function getAiCapabilities(): AiCapabilities {
  const entitlement = getAiEntitlement()
  const premiumEnabled = entitlement.hasPremiumAccess

  return {
    entitlement,
    premiumEnabled,
    canAutoClassifyNotes: premiumEnabled,
    canUseAssistantPlanner: premiumEnabled,
    assistantFallbackMode: 'plain_note_capture',
    marketingEnabled: !entitlement.isTestOverride,
  }
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
