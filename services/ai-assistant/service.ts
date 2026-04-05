import { applyCleanupPlan, planCleanup } from './cleanup'
import { executeAssistantPlan, planAssistantActions } from './orchestrator'
import { AssistantActionResponse, AssistantIntent, CleanupApplyResult, CleanupPlan } from './types'

export type AssistantRunResult =
  | { ok: true; intent: 'capture'; result: AssistantActionResponse }
  | { ok: true; intent: 'cleanup'; result: CleanupPlan }
  | { ok: false; degrade: true; reason: 'all_models_failed' }
  | { ok: false; degrade: false; reason: 'parse_error' | 'execution_error' }

const CLEANUP_INTENT_PATTERN =
  /\b(organize|organise|cleanup|clean up|tidy|merge|rename|fix contexts|fix my contexts|plan my notes|plan my contexts|sort my notes|sort my contexts|review my notes|review my contexts)\b/i

export function detectAssistantIntent(userMessage: string): AssistantIntent {
  return CLEANUP_INTENT_PATTERN.test(userMessage) ? 'cleanup' : 'capture'
}

export async function runAiAssistant(userMessage: string): Promise<AssistantRunResult> {
  const intent = detectAssistantIntent(userMessage)

  let plan
  try {
    plan = intent === 'cleanup'
      ? await planCleanup(userMessage)
      : await planAssistantActions(userMessage)
  } catch {
    return { ok: false, degrade: true, reason: 'all_models_failed' }
  }

  try {
    if (!Array.isArray(plan.actions)) {
      return { ok: false, degrade: false, reason: 'parse_error' }
    }
    if (intent === 'cleanup') {
      return { ok: true, intent, result: plan as CleanupPlan }
    }

    const result = await executeAssistantPlan(plan as import('./types').AssistantActionPlan)
    return { ok: true, intent, result }
  } catch {
    return { ok: false, degrade: false, reason: 'execution_error' }
  }
}

export async function applyAiCleanupPlan(plan: CleanupPlan): Promise<CleanupApplyResult> {
  return applyCleanupPlan(plan)
}
