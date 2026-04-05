import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { ContextsRepo } from '@/lib/db/contexts-repo'
import { NotesRepo } from '@/lib/db/notes-repo'
import { NotificationManager } from '@/lib/services/notification-manager'
import { useNotificationIntentStore } from '@/lib/store/notification-intent-store'
import { useNoteUiHintsStore } from '@/lib/store/note-ui-hints-store'
import type { Context, Note } from '@/lib/store/notes-store'
import { useNotesStore } from '@/lib/store/notes-store'
import {
  buildCategorySections,
  getNewlyClassifiedContextIds,
  getSectionCounts,
  isPlaceholderSectionItem,
  isEditableContextSection,
  syncCollapsedSections,
  toDisplaySections,
} from '@/lib/utils/category-sections'
import { logger } from '@/lib/utils/logger'

type Category = 'HAVE' | 'NICE' | 'URGENT'

export function useCategoryNotesScreen(category: Category) {
  const allNotes = useNotesStore(state => state.notes) as Note[]
  const allContexts = useNotesStore(state => state.contexts) as Context[]
  const loadNotes = useNotesStore(state => state.loadNotes)

  const pendingOpenIntent = useNotificationIntentStore(state => state.pendingOpenIntent)
  const shouldShowDoneHint = useNotificationIntentStore(state => state.shouldShowDoneHint)
  const doneHintNoteId = useNotificationIntentStore(state => state.doneHintNoteId)
  const consumeOpenIntent = useNotificationIntentStore(state => state.consumeOpenIntent)
  const dismissDoneHint = useNotificationIntentStore(state => state.dismissDoneHint)
  const doneActionHintHydrated = useNoteUiHintsStore(state => state.hydrated)
  const hasSeenDoneActionHint = useNoteUiHintsStore(state => state.hasSeenDoneActionHint)
  const initializeNoteUiHints = useNoteUiHintsStore(state => state.initialize)
  const dismissDoneActionHint = useNoteUiHintsStore(state => state.dismissDoneActionHint)

  const [sheetVisible, setSheetVisible] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [newNoteOpen, setNewNoteOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [editingContextId, setEditingContextId] = useState<string | null>(null)
  const [editingContextName, setEditingContextName] = useState('')

  const prevNotesRef = useRef<Note[]>([])
  const isInitialLoadRef = useRef(true)

  const notes = useMemo(() => allNotes.filter(note => note.category === category), [allNotes, category])
  const contexts = useMemo(() => allContexts.filter(context => context.category === category), [allContexts, category])
  const selectedNote = useMemo(
    () => allNotes.find(note => note.id === selectedNoteId) ?? null,
    [allNotes, selectedNoteId]
  )

  useEffect(() => {
    async function initAndLoad() {
      setLoading(true)
      try {
        await Promise.all([NotesRepo.init(), ContextsRepo.init()])
        await loadNotes(category)
      } catch (err) {
        logger.error('Failed to init/load notes or contexts', { err, category })
        Alert.alert('Error', 'Failed to load notes or contexts')
      } finally {
        setLoading(false)
        isInitialLoadRef.current = false
      }
    }

    void initAndLoad()
  }, [category, loadNotes])

  useEffect(() => {
    void initializeNoteUiHints()
  }, [initializeNoteUiHints])

  useEffect(() => {
    if (loading) return

    setCollapsedSections(prev => syncCollapsedSections(prev, contexts))
  }, [contexts, loading])

  useEffect(() => {
    if (isInitialLoadRef.current) {
      prevNotesRef.current = notes
      return
    }

    const newlyClassifiedContextIds = getNewlyClassifiedContextIds(prevNotesRef.current, notes)

    if (newlyClassifiedContextIds.length > 0) {
      setCollapsedSections(prev => {
        const next = { ...prev }
        newlyClassifiedContextIds.forEach(contextId => {
          next[contextId] = false
        })
        return next
      })
    }

    prevNotesRef.current = notes
  }, [notes])

  useEffect(() => {
    if (!pendingOpenIntent || pendingOpenIntent.category !== category) return

    const targetNote = allNotes.find(
      note => note.id === pendingOpenIntent.noteId && note.category === category
    )
    if (!targetNote) return

    setSelectedNoteId(targetNote.id)
    setDetailModalOpen(true)
    consumeOpenIntent()
  }, [allNotes, category, consumeOpenIntent, pendingOpenIntent])

  async function onSelectContext(contextId: string) {
    if (!selectedNoteId) return

    if (selectedNote?.status === 'DONE') {
      await NotificationManager.markNoteUndone(selectedNoteId)
    }

    await NotesRepo.moveNoteToContext(selectedNoteId, contextId)
    const contextName = contexts.find(context => context.id === contextId)?.name ?? 'Unknown Context'
    Alert.alert('Moved', `Note moved to ${contextName}`)
    setSheetVisible(false)
    setSelectedNoteId(null)
    await loadNotes(category)
  }

  async function handleMarkDone(noteId: string) {
    try {
      const targetNote = allNotes.find(note => note.id === noteId)
      if (targetNote?.status === 'DONE') {
        await NotificationManager.markNoteUndone(noteId)
      } else {
        await NotificationManager.markNoteDone(noteId)
        Alert.alert('Done', 'Note moved to Done and reminders cancelled.')
      }
      await loadNotes(category)
    } catch (error) {
      logger.error('Failed to mark note as done', { error: error as any, category })
      Alert.alert('Error', 'Failed to mark note as done')
    }
  }

  async function handleDelete(noteId: string) {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await NotificationManager.cancelAllReminders(noteId)
            await NotesRepo.deleteNote(noteId)
            await loadNotes(category)
          } catch (error) {
            logger.error('Failed to delete note', { error: error as any, category })
            Alert.alert('Error', 'Failed to delete note')
          }
        },
      },
    ])
  }

  function handleEditContext(section: { id: string; title: string }) {
    if (!isEditableContextSection(section.id, contexts)) return
    setEditingContextId(section.id)
    setEditingContextName(section.title)
  }

  async function handleUpdateContext(id: string, name: string) {
    const parsed = name.trim()
    const currentContext = contexts.find(context => context.id === id)

    if (!currentContext) {
      setEditingContextId(null)
      setEditingContextName('')
      return
    }

    if (parsed.toLowerCase() === currentContext.name.trim().toLowerCase()) {
      setEditingContextId(null)
      setEditingContextName('')
      return
    }

    if (!parsed) {
      Alert.alert('Invalid name', 'Context name cannot be empty')
      return
    }

    const isDuplicate = contexts.some(
      context => context.name.toLowerCase() === parsed.toLowerCase() && context.id !== id
    )
    if (isDuplicate) {
      Alert.alert('Duplicate name', 'Another context with this name already exists')
      return
    }

    try {
      await ContextsRepo.updateContextName(id, parsed)
      await loadNotes(category)
      setEditingContextId(null)
      setEditingContextName('')
    } catch (err) {
      logger.error('Failed to update context', { err, category })
      Alert.alert('Error', 'Failed to update context')
    }
  }

  const sections = useMemo(() => buildCategorySections(notes, contexts), [notes, contexts])
  const displaySections = useMemo(
    () => toDisplaySections(sections, collapsedSections),
    [sections, collapsedSections]
  )
  const sectionCounts = useMemo(() => getSectionCounts(sections), [sections])
  const firstUndoneNoteId = useMemo(() => {
    for (const section of displaySections) {
      for (const item of section.data) {
        if (isPlaceholderSectionItem(item)) continue
        if (item.status !== 'DONE') return item.id
      }
    }

    return null
  }, [displaySections])

  function toggleSection(id: string) {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function isEditableSection(sectionId: string) {
    return isEditableContextSection(sectionId, contexts)
  }

  async function refreshNotes() {
    await loadNotes(category)
  }

  return {
    contexts,
    displaySections,
    doneActionHintHydrated,
    dismissDoneActionHint,
    doneHintNoteId,
    detailModalOpen,
    dismissDoneHint,
    editingContextId,
    editingContextName,
    firstUndoneNoteId,
    handleDelete,
    handleEditContext,
    handleMarkDone,
    handleUpdateContext,
    hasSeenDoneActionHint,
    isEditableSection,
    loading,
    newNoteOpen,
    notes,
    onSelectContext,
    sectionCounts,
    selectedNoteId,
    setDetailModalOpen,
    setEditingContextName,
    setNewNoteOpen,
    setSelectedNoteId,
    setSheetVisible,
    sheetVisible,
    shouldShowDoneHint,
    toggleSection,
    collapsedSections,
    refreshNotes,
  }
}
