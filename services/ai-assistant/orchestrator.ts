import { ContextsRepo } from '../../app/db/contexts-repo'
import { NotesRepo } from '../../app/db/notes-repo'
import { createNote } from '../../app/services/note-creator'
import { NotificationManager } from '../../app/services/notification-manager'
import { useNotesStore } from '../../app/store/notes-store'
import { buildSystemPrompt } from './prompt'
import { AI_ASSISTANT_ACTION_SCHEMA } from './schema'
import { callAiAssistant } from './client'
import { AssistantActionPlan, AssistantActionResponse, CreateNoteAction } from './types'

function ensureIso(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function resolveContextId(action: CreateNoteAction): Promise<string | null> {
  if (!action.context) return null

  if (action.context.mode === 'existing') {
    return action.context.contextId ?? null
  }

  const name = action.context.contextName?.trim()
  if (!name) return null

  const contexts = await ContextsRepo.listContexts()
  const existing = contexts.find(
    (context) =>
      context.category === action.category &&
      context.name.trim().toLowerCase() === name.toLowerCase()
  )

  if (existing) return existing.id

  await ContextsRepo.createContexts([name], action.category)
  const refreshed = await ContextsRepo.listContexts()
  const createdContext = refreshed.find(
    (context) =>
      context.category === action.category &&
      context.name.trim().toLowerCase() === name.toLowerCase()
  )

  if (createdContext) {
    useNotesStore.getState().addContext(createdContext)
  }

  return createdContext?.id ?? null
}

async function applyReminderPlan(noteId: string, action: CreateNoteAction) {
  const firstReminderIso = ensureIso(action.reminders[0] ?? null)
  const dueDateIso = ensureIso(action.dueDate)

  if (action.category === 'URGENT' && dueDateIso) {
    const dueAt = new Date(dueDateIso).getTime()
    const reminderAt = firstReminderIso
      ? new Date(firstReminderIso).getTime()
      : dueAt - 4 * 60 * 60 * 1000
    await NotesRepo.updateUrgentReminders(noteId, reminderAt, dueAt)
    await NotificationManager.scheduleUrgentBatch(noteId, __DEV__)
    return
  }

  if (firstReminderIso) {
    const reminderAt = new Date(firstReminderIso).getTime()
    await NotesRepo.updateReminder(noteId, reminderAt)
    await NotificationManager.scheduleSingleReminder(noteId, reminderAt)
  }
}

export async function planAssistantActions(userMessage: string): Promise<AssistantActionPlan> {
  await ContextsRepo.init()
  const contexts = await ContextsRepo.listContexts()
  const systemPrompt = buildSystemPrompt(new Date().toISOString(), contexts)
  const raw = await callAiAssistant(systemPrompt, userMessage, {
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: AI_ASSISTANT_ACTION_SCHEMA.name,
        schema: AI_ASSISTANT_ACTION_SCHEMA.schema,
        strict: true,
      },
    },
  })

  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  return JSON.parse(cleaned) as AssistantActionPlan
}

export async function executeAssistantPlan(plan: AssistantActionPlan): Promise<AssistantActionResponse> {
  const createdNotes = []

  for (const action of plan.actions) {
    if (action.type !== 'create_note') continue

    const contextId = await resolveContextId(action)
    const note = await createNote({
      title: action.title,
      body: action.body ?? undefined,
      category: action.category,
      contextId,
      source: 'ai',
    })

    await applyReminderPlan(note.id, action)
    createdNotes.push(note)
  }

  await useNotesStore.getState().loadNotes()

  return {
    createdNotes,
    summary: plan.summary,
  }
}
