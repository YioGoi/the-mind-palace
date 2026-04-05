import { ContextsRepo } from '../../lib/db/contexts-repo'
import { NotesRepo } from '../../lib/db/notes-repo'
import { createNote } from '../../lib/services/note-creator'
import { NotificationManager } from '../../lib/services/notification-manager'
import { useNotesStore } from '../../lib/store/notes-store'
import { logger } from '../../lib/utils/logger'
import { getAiCapabilities } from '../ai/config'
import { buildSystemPrompt } from './prompt'
import { AI_ASSISTANT_ACTION_SCHEMA } from './schema'
import { callAiAssistant } from './client'
import { AssistantActionPlan, AssistantActionResponse, CreateNoteAction } from './types'

function getLocalTimezoneOffsetIso(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0')
  return `${sign}${hours}:${minutes}`
}

function getCurrentLocalIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${getLocalTimezoneOffsetIso(now)}`
}

function ensureIso(value: string | null): string | null {
  if (!value) return null
  const normalized = value.trim()
  const timeOnlyMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (timeOnlyMatch) {
    const [, hour, minute, second] = timeOnlyMatch
    const now = new Date()
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(hour),
      Number(minute),
      Number(second ?? '0'),
      0
    )

    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 1)
    }

    return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString()
  }

  const localDateTimeWithSpaceMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/
  )
  if (localDateTimeWithSpaceMatch) {
    const [, year, month, day, hour, minute, second] = localDateTimeWithSpaceMatch
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? '0'),
      0
    )
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const localWallClockMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/
  )

  if (localWallClockMatch) {
    const [, year, month, day, hour, minute, second] = localWallClockMatch
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? '0'),
      0
    )
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function sanitizeActionText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized
}

function sanitizePlan(plan: AssistantActionPlan): AssistantActionPlan {
  const normalizedActions = Array.isArray(plan.actions) ? plan.actions.slice(0, 5) : []

  return {
    summary: sanitizeActionText(plan.summary, 240) ?? 'Your notes are ready.',
    actions: normalizedActions
      .filter((action): action is CreateNoteAction => action?.type === 'create_note')
      .map((action) => ({
        ...action,
        title: sanitizeActionText(action.title, 120) ?? '',
        body: sanitizeActionText(action.body, 5000),
        dueDate: sanitizeActionText(action.dueDate, 64),
        reminders: Array.from(
          new Set(
            (Array.isArray(action.reminders) ? action.reminders : [])
              .map((value) => sanitizeActionText(value, 64))
              .filter((value): value is string => Boolean(value))
          )
        ),
        context: action.context
          ? {
              ...action.context,
              contextId: sanitizeActionText(action.context.contextId, 120),
              contextName: sanitizeActionText(action.context.contextName, 120),
            }
          : null,
      }))
      .filter((action) => action.title.length > 0),
  }
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

async function applyReminderPlan(noteId: string, action: CreateNoteAction): Promise<string[]> {
  const warnings: string[] = []
  const firstReminderIso = ensureIso(action.reminders[0] ?? null)
  const dueDateIso = ensureIso(action.dueDate)

  if (action.category === 'URGENT') {
    const dueAt = dueDateIso ? new Date(dueDateIso).getTime() : null
    const reminderAt = firstReminderIso
      ? new Date(firstReminderIso).getTime()
      : dueAt
      ? dueAt - 4 * 60 * 60 * 1000
      : null

    if (dueAt !== null && !Number.isFinite(dueAt)) {
      warnings.push(`Skipped invalid due date for "${action.title}".`)
      return warnings
    }

    if (reminderAt !== null && !Number.isFinite(reminderAt)) {
      warnings.push(`Skipped invalid reminder time for "${action.title}".`)
      return warnings
    }

    if (reminderAt === null && dueAt === null) {
      return warnings
    }

    if (reminderAt !== null && dueAt !== null && reminderAt >= dueAt) {
      warnings.push(`Skipped invalid urgent reminder plan for "${action.title}".`)
      return warnings
    }

    await NotesRepo.updateUrgentReminders(noteId, reminderAt, dueAt)
    await NotificationManager.scheduleUrgentBatch(noteId, __DEV__)
    return warnings
  }

  if (firstReminderIso) {
    const reminderAt = new Date(firstReminderIso).getTime()
    if (!Number.isFinite(reminderAt)) {
      warnings.push(`Skipped invalid reminder time for "${action.title}".`)
      return warnings
    }
    await NotesRepo.updateReminder(noteId, reminderAt)
    await NotificationManager.scheduleSingleReminder(noteId, reminderAt)
  }

  return warnings
}

export async function planAssistantActions(userMessage: string): Promise<AssistantActionPlan> {
  await ContextsRepo.init()
  const contexts = await ContextsRepo.listContexts()
  const systemPrompt = buildSystemPrompt(getCurrentLocalIso(), Intl.DateTimeFormat().resolvedOptions().timeZone, contexts)
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
  return sanitizePlan(JSON.parse(cleaned) as AssistantActionPlan)
}

export async function executeAssistantPlan(plan: AssistantActionPlan): Promise<AssistantActionResponse> {
  const capabilities = getAiCapabilities()
  const createdNotes = []
  const warnings: string[] = []

  for (const rawAction of sanitizePlan(plan).actions) {
    if (rawAction.type !== 'create_note') continue
    const action = rawAction

    const contextId = await resolveContextId(action)
    const note = await createNote({
      title: action.title,
      body: action.body ?? undefined,
      category: action.category,
      contextId,
      autoClassify: capabilities.canAutoClassifyNotes && !contextId,
      source: 'ai',
    })

    try {
      const reminderWarnings = await applyReminderPlan(note.id, action)
      warnings.push(...reminderWarnings)
    } catch (err) {
      logger.error('Assistant reminder scheduling failed after note creation', {
        noteId: note.id,
        title: action.title,
        err,
      })
      warnings.push(`Created "${action.title}", but its reminders could not be scheduled.`)
    }

    createdNotes.push(note)
  }

  await useNotesStore.getState().loadNotes()

  return {
    createdNotes,
    summary: sanitizeActionText(plan.summary, 240) ?? 'Your notes are ready.',
    warnings,
  }
}
