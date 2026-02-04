// Context Engine Output Parser
import { ContextEngineError, ContextEngineResult } from './types'

export function parseContextEngineOutput(raw: string): ContextEngineResult {
  console.log('[Parser] Raw input:', raw)
  let obj: any
  try {
    obj = JSON.parse(raw)
    console.log('[Parser] Parsed object:', obj)
  } catch (e) {
    console.error('[Parser] JSON parse error:', e)
    throw new ContextEngineError('Invalid JSON', raw)
  }
  // Validate against schema (minimal, deterministic)
  if (obj && obj.type === 'assign' && typeof obj.contextId === 'string') {
    console.log('[Parser] Matched: type=assign with contextId')
    return { type: 'assign', contextId: obj.contextId }
  }
  if (obj && obj.type === 'propose' && typeof obj.proposedContext === 'string') {
    console.log('[Parser] Matched: type=propose with proposedContext')
    return { type: 'propose', proposedContext: obj.proposedContext }
  }
  // Handle case where AI returns just {"contextId": "..."} without type field
  if (obj && typeof obj.contextId === 'string' && !obj.type) {
    console.log('[Parser] Matched: contextId without type field')
    return { type: 'assign', contextId: obj.contextId }
  }
  // Handle case where AI returns just {"proposedContext": "..."} without type field
  if (obj && typeof obj.proposedContext === 'string' && !obj.type) {
    console.log('[Parser] Matched: proposedContext without type field')
    return { type: 'propose', proposedContext: obj.proposedContext }
  }
  console.error('[Parser] No match found. Object:', obj)
  throw new ContextEngineError('Output does not match schema', raw)
}
