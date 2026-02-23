import NewNoteModal from '@/components/new-note-modal'
import NoteCard from '@/components/note-card'
import NoteDetailModal from '@/components/note-detail-modal'
import Fab from '@/components/ui/fab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import QuickActionSheet from '@/components/ui/quick-action-sheet'
import { Palette } from '@/constants/palette'
import { Image } from 'expo-image'
import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NotesRepo } from '../db/notes-repo'
import { NotificationManager } from '../services/notification-manager'
import type { Context, Note } from '../store/notes-store'
import { useNotesStore } from '../store/notes-store'
import { logger } from '../utils/logger'

export default function UrgentScreen() {
  const CATEGORY = 'URGENT'

  // Use Zustand store - subscribe to arrays directly (Zustand handles re-renders)
  const allNotes = useNotesStore(state => state.notes) as Note[]
  const allContexts = useNotesStore(state => state.contexts) as Context[]
  const loadNotes = useNotesStore(state => state.loadNotes)

  const [sheetVisible, setSheetVisible] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [newNoteOpen, setNewNoteOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  // Track previous notes to detect newly classified ones
  const prevNotesRef = useRef<Note[]>([])
  const isInitialLoadRef = useRef(true)

  // Filter for this category
  const notes = React.useMemo(() => allNotes.filter(n => n.category === CATEGORY), [allNotes, CATEGORY])
  const contexts = React.useMemo(() => allContexts.filter(c => c.category === CATEGORY), [allContexts, CATEGORY])

  // DEBUG: Log store state changes
  useEffect(() => {
    logger.info('[URGENT SCREEN] Store updated', {
      allNotesCount: allNotes.length,
      allContextsCount: allContexts.length,
      filteredNotesCount: notes.length,
      filteredContextsCount: contexts.length,
      notes: notes.map(n => ({ id: n.id, title: n.title, contextId: n.contextId, status: n.classificationStatus })),
      contexts: contexts.map(c => ({ id: c.id, name: c.name }))
    })
  }, [allNotes, allContexts, notes, contexts])

  useEffect(() => {
    logger.info('[URGENT SCREEN] useEffect (initAndLoad) triggered', { when: 'mount', loading })
    async function initAndLoad() {
      logger.info('[URGENT SCREEN] initAndLoad START', { loading })
      setLoading(true)
      try {
        await Promise.all([
          NotesRepo.init(),
          (await import('../db/contexts-repo')).ContextsRepo.init()
        ])
        logger.info('[URGENT SCREEN] Calling loadNotes', { CATEGORY })
        await loadNotes(CATEGORY)
        logger.info('[URGENT SCREEN] loadNotes finished', { CATEGORY })
      } catch (err) {
        logger.error('Failed to init/load notes or contexts', { err })
        Alert.alert('Error', 'Failed to load notes or contexts')
      } finally {
        logger.info('[URGENT SCREEN] initAndLoad END', { loading })
        setLoading(false)
        isInitialLoadRef.current = false
      }
    }
    initAndLoad()
  }, [])

  // Auto-collapse new sections (guard against infinite loop)
  useEffect(() => {
    if (loading) return // Don't set collapsed state until data is loaded
    // Only update collapsedSections if new context IDs are present
    setCollapsedSections(prev => {
      const next = { ...prev }
      let changed = false
      for (const c of contexts) {
        if (!(c.id in next)) {
          next[c.id] = true
          changed = true
        }
      }
      if (!('unsorted' in next)) {
        next['unsorted'] = true
        changed = true
      }
      if (!('__classifying' in next)) {
        next['__classifying'] = false
        changed = true
      }
      // Only return new object if changed, else return prev to avoid unnecessary re-renders
      return changed ? next : prev
    })
  }, [contexts, loading])

  // Auto-expand sections when notes are added to them
  useEffect(() => {
    // Skip auto-expand on initial load
    if (isInitialLoadRef.current) {
      prevNotesRef.current = notes
      return
    }

    // Find notes that were just classified (were pending before, now assigned)
    const prevNotes = prevNotesRef.current
    const newlyClassified = notes.filter(note => {
      if (note.classificationStatus !== 'assigned' || !note.contextId) return false

      const prevNote = prevNotes.find(n => n.id === note.id)
      // New note or status changed from pending to assigned
      return !prevNote || prevNote.classificationStatus === 'pending'
    })

    if (newlyClassified.length > 0) {
      setCollapsedSections(prev => {
        const next = { ...prev }
        newlyClassified.forEach(note => {
          if (note.contextId) {
            next[note.contextId] = false // Expand only the newly assigned section
          }
        })
        return next
      })
    }

    // Update ref for next comparison
    prevNotesRef.current = notes
  }, [notes])

  async function onSelectContext(contextId: string) {
    if (!selectedNoteId) return
    const previous = await NotesRepo.moveNoteToContext(selectedNoteId, contextId)
    Alert.alert('Moved', `Note moved (${selectedNoteId}) from ${previous ?? 'none'} to ${contextId}`)
    setSheetVisible(false)
    setSelectedNoteId(null)
    // Refresh store data
    await loadNotes(CATEGORY)
  }

  async function handleMarkDone(noteId: string) {
    try {
      await NotificationManager.markNoteDone(noteId)
      Alert.alert('Done', 'Note marked as done. All reminders cancelled.')
      await loadNotes(CATEGORY)
    } catch (error) {
      logger.error('Failed to mark note as done', { error: error as any })
      Alert.alert('Error', 'Failed to mark note as done')
    }
  }

  async function handleDelete(noteId: string) {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Cancel any reminders first
              await NotificationManager.cancelAllReminders(noteId)
              await NotesRepo.deleteNote(noteId)
              await loadNotes(CATEGORY)
            } catch (error) {
              logger.error('Failed to delete note', { error: error as any })
              Alert.alert('Error', 'Failed to delete note')
            }
          },
        },
      ]
    )
  }

  const sections = React.useMemo(() => {
    // contexts is already filtered for CATEGORY
    const mapped = contexts.map((c) => ({ title: c.name, id: c.id, data: notes.filter((n) => n.contextId === c.id) }))

    // Pending notes (being classified by AI)
    const pending = notes.filter((n) => n.classificationStatus === 'pending')

    const result = [] as Array<{ title: string; id: string; data: any[] }>

    // Show pending notes at the top while AI is working
    if (pending.length) {
      result.push({ title: '🤖 Classifying...', id: '__classifying', data: pending })
    }

    // Unassigned notes (classification failed or no context assigned)
    const unassigned = notes.filter((n) => !n.contextId && n.classificationStatus !== 'pending')
    if (unassigned.length) result.push({ title: 'Unsorted', id: 'unsorted', data: unassigned })

    // ALWAYS include contexts for the category so headers (accordions) are visible even when empty
    for (const s of mapped) result.push(s)

    logger.info('[URGENT SCREEN] Sections computed', {
      pendingCount: pending.length,
      unassignedCount: unassigned.length,
      contextSections: mapped.length,
      sections: result.map(s => ({ id: s.id, title: s.title, count: s.data.length, noteIds: s.data.map(n => n.id) }))
    })

    return result
  }, [notes, contexts, CATEGORY])

  const toggleSection = (id: string) => setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }))

  const displaySections = React.useMemo(
    () =>
      sections.map((s) => ({
        ...s,
        data: collapsedSections[s.id]
          ? [{ __placeholder: true, id: `${s.id}-placeholder` }]
          : s.data,
      })),
    [sections, collapsedSections]
  )

  const sectionCounts = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of sections) m[s.id] = s.data.length
    return m
  }, [sections])

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Palette.colorDanger} />
        </View>
      ) : (
        <>
          <View style={styles.bannerWrapper}>
            <Image
              source={require('@/assets/images/urgent-banner.png')}
              style={styles.banner}
              contentFit="contain"
              accessibilityLabel="Urgent banner"
            />
          </View>

          <SectionList
            sections={displaySections}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingTop: 24, paddingBottom: 100 }}
            style={styles.sectionList}
            showsVerticalScrollIndicator={true}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item, section }) => {
              if ((item as any).__placeholder) return null
              return (
                <NoteCard
                  id={item.id}
                  title={item.title}
                  subtitle={section?.title}
                  reminderAt={item.initialReminderAt}
                  onPress={() => {
                    setSelectedNoteId(item.id)
                    setDetailModalOpen(true)
                  }}
                  onLongPress={() => {
                    setSelectedNoteId(item.id)
                    setSheetVisible(true)
                  }}
                  swipeActions={[
                    {
                      text: 'Done',
                      backgroundColor: Palette.colorSuccess,
                      onPress: () => handleMarkDone(item.id),
                    },
                    {
                      text: 'Delete',
                      backgroundColor: Palette.colorDanger,
                      onPress: () => handleDelete(item.id),
                    },
                  ]}
                />
              )
            }}
            renderSectionHeader={({ section }) => {
              const hasPending = section.data.some((n: any) => n.classificationStatus === 'pending')
              return (
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(section.id)}
                  activeOpacity={0.7}
                  testID={`section-header-${section.id}`}
                >
                  <Text style={styles.sectionTitle}>
                    {section.title}
                    {hasPending ? (
                      <View style={{ marginLeft: 8, transform: [{ translateY: 2 }] }}>
                        <ActivityIndicator size="small" color={Palette.colorDanger} />
                      </View>
                    ) : sectionCounts[section.id] ? (
                      <Text style={styles.sectionCount}> ({sectionCounts[section.id]})</Text>
                    ) : null}
                  </Text>
                  <IconSymbol name="chevron.right" size={22} color={Palette.colorDanger} style={{ transform: [{ rotate: collapsedSections[section.id] ? '0deg' : '90deg' }] }} />
                </TouchableOpacity>
              )
            }}
            ListEmptyComponent={<Text style={{ padding: 12 }}>No notes</Text>}
          />
          <QuickActionSheet
            visible={sheetVisible}
            contexts={contexts}
            onClose={() => setSheetVisible(false)}
            onSelect={onSelectContext}
          />

          <NoteDetailModal
            visible={detailModalOpen}
            noteId={selectedNoteId}
            onClose={() => {
              setDetailModalOpen(false)
              setSelectedNoteId(null)
            }}
            onUpdate={async () => await loadNotes(CATEGORY)}
          />

          <NewNoteModal visible={!!newNoteOpen} category="URGENT" onClose={() => setNewNoteOpen(false)} onCreated={() => setNewNoteOpen(false)} />
          <Fab testID="fab-urgent" onPress={() => setNewNoteOpen(true)} color={Palette.colorDanger} />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bannerWrapper: { marginHorizontal: 0, marginBottom: 8, borderRadius: 12, overflow: 'hidden', height: 140, backgroundColor: '#E8F0FF', alignItems: 'center', justifyContent: 'center' },
  banner: { width: '100%', height: '100%' },
  sectionList: { flex: 1 },
  sectionHeader: { padding: 12, backgroundColor: '#FFF1F1', borderBottomWidth: 1, borderBottomColor: Palette.colorBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.colorDanger },
  sectionCount: { fontSize: 14, color: Palette.colorDanger, opacity: 0.85 },
  sectionIndicator: { fontSize: 18, color: Palette.colorDanger },
})