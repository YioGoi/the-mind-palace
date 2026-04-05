import { ContextsRepo } from '../../lib/db/contexts-repo'
import { FeedbackRepo } from '../../lib/db/feedback-repo'
import { NotesRepo } from '../../lib/db/notes-repo'
import { useNotesStore } from '../../lib/store/notes-store'
import { logger } from '../../lib/utils/logger'
import { callAiAssistant } from './client'
import { buildCleanupPlannerPrompt } from './cleanup-prompt'
import { AI_CLEANUP_PLAN_SCHEMA } from './cleanup-schema'
import { CleanupAction, CleanupApplyResult, CleanupPlan } from './types'

type Category = 'HAVE' | 'URGENT' | 'NICE'

const GENERIC_CONTEXT_NAMES = new Set([
  'new',
  'misc',
  'miscellaneous',
  'general',
  'stuff',
  'things',
  'random',
  'other',
  'others',
  'notes',
  'todo',
  'todos',
  'ideas',
  'yeni',
])

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

function sanitizeText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized
}

function isGenericContextName(name: string) {
  const normalized = name.trim().toLowerCase()
  return GENERIC_CONTEXT_NAMES.has(normalized)
}

function sanitizeCleanupPlan(
  plan: CleanupPlan,
  contexts: Awaited<ReturnType<typeof ContextsRepo.listContexts>>,
  notes: Awaited<ReturnType<typeof NotesRepo.listAll>>
): CleanupPlan {
  const contextMap = new Map(contexts.map((context) => [context.id, context]))
  const noteMap = new Map(notes.map((note) => [note.id, note]))

  const actions = (Array.isArray(plan.actions) ? plan.actions : [])
    .slice(0, 20)
    .flatMap((action): CleanupAction[] => {
      const reason = sanitizeText((action as CleanupAction).reason, 240)
      if (!reason) return []

      if (action.type === 'rename_context') {
        const context = contextMap.get(action.contextId)
        const newName = sanitizeText(action.newName, 120)
        if (!context || !newName) return []
        if (context.name.trim().toLowerCase() === newName.toLowerCase()) return []
        return [{ type: 'rename_context', contextId: action.contextId, newName, reason }]
      }

      if (action.type === 'move_notes') {
        const targetContext = contextMap.get(action.targetContextId)
        if (!targetContext) return []
        if (isGenericContextName(targetContext.name)) return []
        const noteIds = Array.from(new Set(action.noteIds))
          .map((id) => sanitizeText(id, 120))
          .filter((id): id is string => Boolean(id))
          .filter((id) => {
            const note = noteMap.get(id)
            return Boolean(note) && note?.category === targetContext.category && note?.contextId !== targetContext.id
          })
        if (noteIds.length === 0) return []
        return [{ type: 'move_notes', noteIds, targetContextId: action.targetContextId, reason }]
      }

      if (action.type === 'create_context_and_move_notes') {
        const contextName = sanitizeText(action.contextName, 120)
        if (!contextName || isGenericContextName(contextName)) return []

        const existingMatch = contexts.find((context) =>
          context.category === action.category &&
          context.name.trim().toLowerCase() === contextName.toLowerCase()
        )
        if (existingMatch) return []

        const noteIds = Array.from(new Set(action.noteIds))
          .map((id) => sanitizeText(id, 120))
          .filter((id): id is string => Boolean(id))
          .filter((id) => {
            const note = noteMap.get(id)
            return Boolean(note) && note?.category === action.category && !note?.contextId
          })
        if (noteIds.length === 0) return []
        return [{ type: 'create_context_and_move_notes', noteIds, category: action.category, contextName, reason }]
      }

      if (action.type === 'merge_contexts') {
        const source = contextMap.get(action.sourceContextId)
        const target = contextMap.get(action.targetContextId)
        if (!source || !target) return []
        if (source.id === target.id || source.category !== target.category) return []
        return [{
          type: 'merge_contexts',
          sourceContextId: action.sourceContextId,
          targetContextId: action.targetContextId,
          reason,
        }]
      }

      if (action.type === 'delete_empty_context') {
        const context = contextMap.get(action.contextId)
        if (!context) return []
        const isEmpty = !notes.some((note) => note.contextId === context.id)
        if (!isEmpty) return []
        return [{ type: 'delete_empty_context', contextId: action.contextId, reason }]
      }

      return []
    })

  return {
    summary: sanitizeText(plan.summary, 240) ?? 'I found a few cleanup opportunities.',
    actions,
  }
}

export async function planCleanup(userMessage: string): Promise<CleanupPlan> {
  await Promise.all([ContextsRepo.init(), NotesRepo.init(), FeedbackRepo.init()])

  const [contexts, notes, feedback] = await Promise.all([
    ContextsRepo.listContexts(),
    NotesRepo.listAll(),
    FeedbackRepo.getRecentFeedback(40),
  ])

  const promptContext = {
    contexts: contexts.map((context) => {
      const contextNotes = notes.filter((note) => note.contextId === context.id)
      return {
        id: context.id,
        name: context.name,
        category: context.category as Category,
        noteCount: contextNotes.length,
        sampleNotes: contextNotes.slice(0, 5).map((note) => ({ id: note.id, title: note.title })),
      }
    }),
    unsortedNotes: notes
      .filter((note) => !note.contextId)
      .slice(0, 20)
      .map((note) => ({
        id: note.id,
        title: note.title,
        category: note.category,
      })),
    feedback: feedback.map((item) => ({
      noteId: item.noteId,
      noteTitle: item.noteTitle,
      aiSuggestedContextId: item.aiSuggestedContextId,
      userChosenContextId: item.userChosenContextId,
      feedback: item.feedback,
    })),
  }

  const raw = await callAiAssistant(
    buildCleanupPlannerPrompt(
      getCurrentLocalIso(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      promptContext
    ),
    userMessage,
    {
      timeoutMs: 60_000,
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: AI_CLEANUP_PLAN_SCHEMA.name,
          schema: AI_CLEANUP_PLAN_SCHEMA.schema,
          strict: true,
        },
      },
    }
  )

  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  return sanitizeCleanupPlan(JSON.parse(cleaned) as CleanupPlan, contexts, notes)
}

export async function applyCleanupPlan(plan: CleanupPlan): Promise<CleanupApplyResult> {
  await Promise.all([ContextsRepo.init(), NotesRepo.init()])

  let contexts = await ContextsRepo.listContexts()
  let notes = await NotesRepo.listAll()
  const details: string[] = []
  let appliedCount = 0
  let skippedCount = 0

  async function refreshState() {
    ;[contexts, notes] = await Promise.all([ContextsRepo.listContexts(), NotesRepo.listAll()])
  }

  async function moveNotes(noteIds: string[], targetContextId: string) {
    let movedCount = 0
    for (const noteId of noteIds) {
      const note = notes.find((item) => item.id === noteId)
      const targetContext = contexts.find((item) => item.id === targetContextId)
      if (!note || !targetContext) continue
      if (note.category !== targetContext.category || note.contextId === targetContextId) continue
      await NotesRepo.moveNoteToContext(noteId, targetContextId)
      await NotesRepo.updateClassification(noteId, targetContextId, 'manual')
      movedCount += 1
    }
    await refreshState()
    return movedCount
  }

  const normalizedPlan = sanitizeCleanupPlan(plan, contexts, notes)

  for (const action of normalizedPlan.actions.filter((item) => item.type === 'rename_context')) {
    const context = contexts.find((item) => item.id === action.contextId)
    if (!context) {
      skippedCount += 1
      details.push(`Skipped rename for missing context ${action.contextId}.`)
      continue
    }

    await ContextsRepo.updateContextName(action.contextId, action.newName)
    await refreshState()
    appliedCount += 1
    details.push(`Renamed "${context.name}" to "${action.newName}".`)
  }

  for (const action of normalizedPlan.actions.filter((item) => item.type === 'move_notes')) {
    const targetContext = contexts.find((item) => item.id === action.targetContextId)
    if (!targetContext) {
      skippedCount += 1
      details.push(`Skipped move because target context ${action.targetContextId} no longer exists.`)
      continue
    }

    const movedCount = await moveNotes(action.noteIds, action.targetContextId)
    if (movedCount === 0) {
      skippedCount += 1
      details.push(`Skipped move into "${targetContext.name}" because no eligible notes remained.`)
      continue
    }

    appliedCount += 1
    details.push(`Moved ${movedCount} note${movedCount === 1 ? '' : 's'} into "${targetContext.name}".`)
  }

  for (const action of normalizedPlan.actions.filter((item) => item.type === 'create_context_and_move_notes')) {
    const createdContext = await ContextsRepo.createContext(action.contextName, action.category)
    await refreshState()

    const movedCount = await moveNotes(action.noteIds, createdContext.id)
    if (movedCount === 0) {
      await ContextsRepo.deleteContext(createdContext.id)
      await refreshState()
      skippedCount += 1
      details.push(`Skipped creating "${action.contextName}" because no eligible unsorted notes remained.`)
      continue
    }

    appliedCount += 1
    details.push(`Created "${createdContext.name}" and moved ${movedCount} note${movedCount === 1 ? '' : 's'} into it.`)
  }

  for (const action of normalizedPlan.actions.filter((item) => item.type === 'merge_contexts')) {
    const sourceContext = contexts.find((item) => item.id === action.sourceContextId)
    const targetContext = contexts.find((item) => item.id === action.targetContextId)
    if (!sourceContext || !targetContext || sourceContext.category !== targetContext.category) {
      skippedCount += 1
      details.push(`Skipped merge for invalid contexts ${action.sourceContextId} → ${action.targetContextId}.`)
      continue
    }

    const sourceNoteIds = notes
      .filter((note) => note.contextId === sourceContext.id)
      .map((note) => note.id)
    const movedCount = await moveNotes(sourceNoteIds, targetContext.id)
    const sourceStillHasNotes = notes.some((note) => note.contextId === sourceContext.id)

    if (sourceStillHasNotes) {
      skippedCount += 1
      details.push(`Merged ${movedCount} note${movedCount === 1 ? '' : 's'} into "${targetContext.name}", but kept "${sourceContext.name}" because it still has notes.`)
      continue
    }

    await ContextsRepo.deleteContext(sourceContext.id)
    await refreshState()
    appliedCount += 1
    details.push(`Merged "${sourceContext.name}" into "${targetContext.name}".`)
  }

  for (const action of normalizedPlan.actions.filter((item) => item.type === 'delete_empty_context')) {
    const context = contexts.find((item) => item.id === action.contextId)
    if (!context) {
      skippedCount += 1
      details.push(`Skipped delete for missing context ${action.contextId}.`)
      continue
    }

    const hasNotes = notes.some((note) => note.contextId === context.id)
    if (hasNotes) {
      skippedCount += 1
      details.push(`Skipped deleting "${context.name}" because it is no longer empty.`)
      continue
    }

    await ContextsRepo.deleteContext(context.id)
    await refreshState()
    appliedCount += 1
    details.push(`Deleted empty context "${context.name}".`)
  }

  await useNotesStore.getState().loadNotes()

  const summary = appliedCount > 0
    ? `Applied ${appliedCount} cleanup action${appliedCount === 1 ? '' : 's'}${skippedCount > 0 ? ` and skipped ${skippedCount}.` : '.'}`
    : 'No cleanup actions were applied.'

  logger.info('Applied cleanup plan', {
    appliedCount,
    skippedCount,
    details,
  })

  return {
    appliedCount,
    skippedCount,
    summary,
    details,
  }
}
