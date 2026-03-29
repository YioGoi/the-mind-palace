export type MessageRole = 'user' | 'assistant'

export type AssistantMessage = {
  id: string
  role: MessageRole
  text: string
}

export type NoteCategory = 'URGENT' | 'HAVE' | 'NICE'

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

export type AssistantActionResponse = {
  createdNotes: Array<{ id: string; title: string }>
  summary: string
}
