import { ContextsRepo } from '../db/contexts-repo'
import { NotesRepo } from '../db/notes-repo'
import { useNotesStore } from '../store/notes-store'
import { logger } from '../utils/logger'

type SeedContextSpec = {
  name: string
  category: 'HAVE' | 'URGENT' | 'NICE'
}

type SeedNoteSpec = {
  title: string
  body?: string
  category: 'HAVE' | 'URGENT' | 'NICE'
  contextName?: string
  reminderAt?: number | null
  initialReminderAt?: number | null
  dueDate?: number | null
}

const CONTEXT_SPECS: SeedContextSpec[] = [
  { name: 'QA Work', category: 'HAVE' },
  { name: 'QA Job', category: 'HAVE' },
  { name: 'QA Home', category: 'HAVE' },
  { name: 'QA Errands', category: 'HAVE' },
  { name: 'QA Empty Archive', category: 'HAVE' },
  { name: 'QA Movies', category: 'NICE' },
  { name: 'QA Film Plans', category: 'NICE' },
  { name: 'QA Deadlines', category: 'URGENT' },
]

function hoursFromNow(hours: number) {
  return Date.now() + hours * 60 * 60 * 1000
}

const NOTE_SPECS: SeedNoteSpec[] = [
  {
    title: 'QA update CV',
    body: 'This probably belongs with work/job notes.',
    category: 'HAVE',
    contextName: 'QA Work',
  },
  {
    title: 'QA follow up with recruiter',
    body: 'Placed in QA Job for merge testing.',
    category: 'HAVE',
    contextName: 'QA Job',
  },
  {
    title: 'QA pay electricity bill',
    body: 'Intentionally placed in QA Home to test moving into errands.',
    category: 'HAVE',
    contextName: 'QA Home',
  },
  {
    title: 'QA buy dish soap',
    category: 'HAVE',
    contextName: 'QA Errands',
  },
  {
    title: 'QA renew passport',
    body: 'Left unsorted on purpose.',
    category: 'HAVE',
  },
  {
    title: 'QA watch sci-fi classic',
    category: 'NICE',
    contextName: 'QA Movies',
  },
  {
    title: 'QA plan film night',
    category: 'NICE',
    contextName: 'QA Film Plans',
  },
  {
    title: 'QA dentist tomorrow',
    category: 'URGENT',
    contextName: 'QA Deadlines',
    initialReminderAt: hoursFromNow(6),
    dueDate: hoursFromNow(10),
  },
]

async function ensureContexts() {
  const existing = await ContextsRepo.listContexts()

  for (const spec of CONTEXT_SPECS) {
    const found = existing.find(
      (context) =>
        context.category === spec.category &&
        context.name.trim().toLowerCase() === spec.name.toLowerCase()
    )
    if (found) continue

    await ContextsRepo.createContexts([spec.name], spec.category)
  }

  return ContextsRepo.listContexts()
}

export async function prepareCleanupQaDataset(): Promise<void> {
  await Promise.all([ContextsRepo.init(), NotesRepo.init()])
  const contexts = await ensureContexts()
  const existingNotes = await NotesRepo.listAll()

  for (const spec of NOTE_SPECS) {
    const alreadyExists = existingNotes.some(
      (note) =>
        note.title.trim().toLowerCase() === spec.title.toLowerCase() &&
        note.category === spec.category
    )
    if (alreadyExists) continue

    const contextId = spec.contextName
      ? contexts.find(
          (context) =>
            context.category === spec.category &&
            context.name.trim().toLowerCase() === spec.contextName?.toLowerCase()
        )?.id ?? null
      : null

    const note = await NotesRepo.insert({
      title: spec.title,
      body: spec.body,
      category: spec.category,
      contextId,
      classificationStatus: contextId ? 'assigned' : 'manual',
      reminderAt: null,
      initialReminderAt: null,
      dueDate: null,
      status: 'PENDING',
    })

    if (spec.category === 'URGENT' && (spec.initialReminderAt || spec.dueDate)) {
      await NotesRepo.updateUrgentReminders(
        note.id,
        spec.initialReminderAt ?? null,
        spec.dueDate ?? null
      )
    }

    if ((spec.category === 'HAVE' || spec.category === 'NICE') && spec.reminderAt) {
      await NotesRepo.updateReminder(note.id, spec.reminderAt)
    }
  }

  await useNotesStore.getState().loadNotes()
  logger.info('Prepared cleanup QA dataset')
}
