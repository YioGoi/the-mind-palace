import { parseContextEngineOutput } from './parser'
import { CONTEXT_ENGINE_PROMPT } from './prompt'
import { Context, ContextEngineResult, NoteInput, UserFeedback } from './types'

// Compose the prompt for the LLM
function buildPrompt(note: NoteInput, contexts: Context[], feedback: UserFeedback = []): string {
  return JSON.stringify({
    instruction: CONTEXT_ENGINE_PROMPT,
    note,
    contexts,
    feedback,
  }, null, 2)
}

// Orchestrate: build prompt, call model, parse output
export async function classifyContextService(
  note: NoteInput,
  contexts: Context[],
  feedback: UserFeedback = [],
  callModel: (prompt: string) => Promise<string>
): Promise<ContextEngineResult> {
  const prompt = buildPrompt(note, contexts, feedback)
  const raw = await callModel(prompt)
  return parseContextEngineOutput(raw)
}
