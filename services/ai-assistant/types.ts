export type MessageRole = 'user' | 'assistant'

export type AssistantMessage = {
  id: string
  role: MessageRole
  text: string
}

export type NoteCategory = 'URGENT' | 'HAVE' | 'NICE'

export type AssistantIntent = 'capture' | 'cleanup'

export type CreateNoteAction = {
  type: 'create_note'
  title: string
  category: NoteCategory
  body: string | null
  dueDate: string | null
  reminders: string[]
  context: {
    mode: 'existing' | 'new'
    contextId: string | null
    contextName: string | null
  } | null
}

export type AssistantActionPlan = {
  actions: CreateNoteAction[]
  summary: string
}

export type CleanupAction =
  | {
      type: 'rename_context'
      contextId: string
      newName: string
      reason: string
    }
  | {
      type: 'move_notes'
      noteIds: string[]
      targetContextId: string
      reason: string
    }
  | {
      type: 'merge_contexts'
      sourceContextId: string
      targetContextId: string
      reason: string
    }
  | {
      type: 'delete_empty_context'
      contextId: string
      reason: string
    }
  | {
      type: 'create_context_and_move_notes'
      noteIds: string[]
      category: NoteCategory
      contextName: string
      reason: string
    }
  | {
      type: 'move_context_to_category'
      contextId: string
      targetCategory: NoteCategory
      reason: string
    }

export type CleanupPlan = {
  summary: string
  actions: CleanupAction[]
}

export type CleanupApplyResult = {
  appliedCount: number
  skippedCount: number
  summary: string
  details: string[]
}

export type AssistantActionResponse = {
  createdNotes: { id: string; title: string }[]
  operationLog: string[]
  summary: string
  warnings: string[]
}
