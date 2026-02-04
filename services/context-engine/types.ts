// Context Engine Types
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
