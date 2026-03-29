import { executeAssistantPlan, planAssistantActions } from './orchestrator'
import { AssistantActionResponse } from './types'

export type AssistantRunResult =
  | { ok: true; result: AssistantActionResponse }
  | { ok: false; degrade: true; reason: 'all_models_failed' }
  | { ok: false; degrade: false; reason: 'parse_error' | 'execution_error' }

export async function runAiAssistant(userMessage: string): Promise<AssistantRunResult> {
  let plan
  try {
    plan = await planAssistantActions(userMessage)
  } catch {
    return { ok: false, degrade: true, reason: 'all_models_failed' }
  }

  try {
    if (!Array.isArray(plan.actions)) {
      return { ok: false, degrade: false, reason: 'parse_error' }
    }
    const result = await executeAssistantPlan(plan)
    return { ok: true, result }
  } catch {
    return { ok: false, degrade: false, reason: 'execution_error' }
  }
}
