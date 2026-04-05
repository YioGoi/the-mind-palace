import type { Context, Note } from '../store/notes-store'

export const SPECIAL_SECTION_IDS = {
  classifying: '__classifying',
  unsorted: 'unsorted',
  done: '__done',
} as const

export type CategorySection = {
  title: string
  id: string
  data: Note[]
}

export type DisplaySectionItem = Note | { __placeholder: true; id: string }

export type DisplayCategorySection = {
  title: string
  id: string
  data: DisplaySectionItem[]
}

export function isPlaceholderSectionItem(
  item: DisplaySectionItem
): item is { __placeholder: true; id: string } {
  return '__placeholder' in item
}

export function buildCategorySections(notes: Note[], contexts: Context[]): CategorySection[] {
  const activeNotes = notes.filter(note => note.status !== 'DONE')
  const doneNotes = notes.filter(note => note.status === 'DONE')
  const pendingNotes = activeNotes.filter(note => note.classificationStatus === 'pending')
  const contextIds = new Set(contexts.map(context => context.id))
  const unsortedNotes = activeNotes.filter(
    note => (!note.contextId || !contextIds.has(note.contextId)) && note.classificationStatus !== 'pending'
  )

  const sections: CategorySection[] = []

  if (pendingNotes.length) {
    sections.push({
      title: '🤖 Classifying...',
      id: SPECIAL_SECTION_IDS.classifying,
      data: pendingNotes,
    })
  }

  if (unsortedNotes.length) {
    sections.push({
      title: 'Unsorted',
      id: SPECIAL_SECTION_IDS.unsorted,
      data: unsortedNotes,
    })
  }

  sections.push(
    ...contexts.map(context => ({
      title: context.name,
      id: context.id,
      data: activeNotes.filter(note => note.contextId === context.id),
    }))
  )

  sections.push({
    title: 'Done',
    id: SPECIAL_SECTION_IDS.done,
    data: doneNotes,
  })

  return sections
}

export function syncCollapsedSections(
  prev: Record<string, boolean>,
  contexts: Context[]
): Record<string, boolean> {
  const next = { ...prev }

  for (const context of contexts) {
    if (!(context.id in next)) {
      next[context.id] = true
    }
  }

  if (!(SPECIAL_SECTION_IDS.unsorted in next)) {
    next[SPECIAL_SECTION_IDS.unsorted] = true
  }

  if (!(SPECIAL_SECTION_IDS.classifying in next)) {
    next[SPECIAL_SECTION_IDS.classifying] = false
  }

  if (!(SPECIAL_SECTION_IDS.done in next)) {
    next[SPECIAL_SECTION_IDS.done] = true
  }

  return next
}

export function getNewlyClassifiedContextIds(prevNotes: Note[], notes: Note[]): string[] {
  return notes
    .filter(note => {
      if (note.classificationStatus !== 'assigned' || !note.contextId) return false

      const prevNote = prevNotes.find(candidate => candidate.id === note.id)
      return !prevNote || prevNote.classificationStatus === 'pending'
    })
    .map(note => note.contextId!)
}

export function toDisplaySections(
  sections: CategorySection[],
  collapsedSections: Record<string, boolean>
): DisplayCategorySection[] {
  return sections.map(section => ({
    ...section,
    data: collapsedSections[section.id]
      ? [{ __placeholder: true, id: `${section.id}-placeholder` }]
      : section.data,
  }))
}

export function getSectionCounts(sections: CategorySection[]): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const section of sections) {
    counts[section.id] = section.data.length
  }

  return counts
}

export function isEditableContextSection(sectionId: string, contexts: Context[]) {
  return contexts.some(context => context.id === sectionId)
}
