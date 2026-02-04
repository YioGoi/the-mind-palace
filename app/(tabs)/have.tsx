import NewNoteModal from '@/components/new-note-modal'
import NoteCard from '@/components/note-card'
import Fab from '@/components/ui/fab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import QuickActionSheet from '@/components/ui/quick-action-sheet'
import { Palette } from '@/constants/palette'
import { Image } from 'expo-image'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NotesRepo } from '../db/notes-repo'
import type { Context, Note } from '../store/notes-store'
import { useNotesStore } from '../store/notes-store'
import { logger } from '../utils/logger'

export default function HaveScreen() {
  const CATEGORY = 'HAVE'
  
  // Use Zustand store - subscribe to arrays directly (Zustand handles re-renders)
  const allNotes = useNotesStore(state => state.notes) as Note[]
  const allContexts = useNotesStore(state => state.contexts) as Context[]
  const loadNotes = useNotesStore(state => state.loadNotes)
  
  const [sheetVisible, setSheetVisible] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [newNoteOpen, setNewNoteOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  // Filter for this category
  const notes = allNotes.filter(n => n.category === CATEGORY)
  const contexts = allContexts.filter(c => c.category === CATEGORY)

  useEffect(() => {
    loadNotes(CATEGORY)
  }, [loadNotes])

  // Auto-collapse new sections
  useEffect(() => {
    setCollapsedSections(prev => {
      const next = { ...prev }
      for (const c of contexts) {
        if (!(c.id in next)) next[c.id] = true
      }
      if (!('unsorted' in next)) next['unsorted'] = true
      if (!('__classifying' in next)) next['__classifying'] = false // Keep classifying open
      return next
    })
  }, [contexts])

  // Auto-expand sections when notes are added to them
  useEffect(() => {
    const justClassified = notes.filter(n => n.classificationStatus === 'assigned' && n.contextId)
    if (justClassified.length > 0) {
      setCollapsedSections(prev => {
        const next = { ...prev }
        justClassified.forEach(note => {
          if (note.contextId && prev[note.contextId] === true) {
            next[note.contextId] = false // Expand the section
          }
        })
        return next
      })
    }
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

  // DEBUG: log when displaySections changes so we can inspect collapsed state and counts
  React.useEffect(() => {
    try {
      const preview = displaySections.map((s) => ({ id: s.id, title: s.title, dataLen: s.data?.length ?? 0 }))
      logger.info('DisplaySectionsDebug', { category: CATEGORY, collapsedSections, preview })
    } catch (e) {
      logger.error('DisplaySectionsDebug failed', { err: (e as any)?.message ?? e })
    }
  }, [displaySections, collapsedSections])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bannerWrapper}>
        <Image source={require('@/assets/images/have-banner.png')} style={styles.banner} contentFit="contain" accessibilityLabel="Have banner" />
      </View>

      <SectionList
        sections={displaySections}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 100 }}
        style={{ flex: 1 }}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item, section }) => {
          if ((item as any).__placeholder) return null
          return (
            <NoteCard
              id={item.id}
              title={item.title}
              subtitle={section?.title}
              onLongPress={() => {
                setSelectedNoteId(item.id)
                setSheetVisible(true)
              }}
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
                    <ActivityIndicator size="small" color={Palette.colorSuccess} />
                  </View>
                ) : sectionCounts[section.id] ? (
                  <Text style={styles.sectionCount}> ({sectionCounts[section.id]})</Text>
                ) : null}
              </Text>
              <IconSymbol name="chevron.right" size={22} color={Palette.colorSuccess} style={{ transform: [{ rotate: collapsedSections[section.id] ? '0deg' : '90deg' }] }} />
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

      <NewNoteModal
        visible={!!newNoteOpen}
        category="HAVE"
        onClose={() => setNewNoteOpen(false)}
        onCreated={() => {
          // Note is already in store from createNote, just close modal
          setNewNoteOpen(false)
        }}
      />

      <Fab testID="fab-have" onPress={() => setNewNoteOpen(true)} color={Palette.colorSuccess} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bannerWrapper: { marginHorizontal: 0, marginBottom: 8, borderRadius: 12, overflow: 'hidden', height: 140, backgroundColor: '#E8F0FF', alignItems: 'center', justifyContent: 'center' },
  banner: { width: '100%', height: '100%' },
  sectionHeader: { padding: 12, backgroundColor: '#F3FFF7', borderBottomWidth: 1, borderBottomColor: Palette.colorBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.colorSuccess },
  sectionCount: { fontSize: 14, color: Palette.colorSuccess, opacity: 0.85 },
  sectionIndicator: { fontSize: 18, color: Palette.colorSuccess },
})
