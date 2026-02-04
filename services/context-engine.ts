// Context Engine for My Mind Palace
// AI assigns context for a note, never category.
// Deterministic, testable, learns from user corrections.

export type Context = { id: string; name: string }
export type NoteInput = { title: string; body?: string }
export type UserFeedback = { contextId: string; feedback: 'correct' | 'incorrect' }[]

export type ContextEngineResult =
  | { type: 'assign'; contextId: string }
  | { type: 'propose'; proposedContext: string }

export class ContextEngineError extends Error {
  constructor(message: string, public rawOutput?: string) {
    super(message)
    this.name = 'ContextEngineError'
  }
}

/**
 * classifyContext: Assigns a note to an existing context or proposes a new one.
 * - Never changes category.
 * - Accepts user feedback for learning.
 * - Returns deterministic JSON.
 */
export async function classifyContext(
  note: NoteInput,
  contexts: Context[],
  feedback: UserFeedback = []
): Promise<ContextEngineResult> {
  // Placeholder: Replace with LLM or rules-based logic
  // For now, assign to first context if exists, else propose
  if (contexts.length > 0) {
    return { type: 'assign', contextId: contexts[0].id }
  } else {
    return { type: 'propose', proposedContext: note.title }
  }
}

// LLM Prompt for context assignment
export const CONTEXT_ENGINE_PROMPT = `
You are an AI assistant for a personal notes app. Your job is to assign each new note to the most relevant existing context, or propose a new context if none fit.
- You will receive:
  - The note's title and body.
  - A list of existing contexts (by name).
  - A list of user feedback on previous assignments (contextId, correct/incorrect).
- Never change the note's category.
- If an existing context fits, return its id.
- If none fit, propose a new context name.
- Output must be a single JSON object, no extra text.
`;

// Output JSON schema (for docs/testing)
export const CONTEXT_ENGINE_SCHEMA = {
  assign: {
    type: 'object',
    properties: {
      type: { const: 'assign' },
      contextId: { type: 'string' },
    },
    required: ['type', 'contextId'],
    additionalProperties: false,
  },
  propose: {
    type: 'object',
    properties: {
      type: { const: 'propose' },
      proposedContext: { type: 'string' },
    },
    required: ['type', 'proposedContext'],
    additionalProperties: false,
  },
};
