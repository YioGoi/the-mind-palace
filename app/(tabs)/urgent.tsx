import React from 'react'
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '@/hooks/use-app-theme'
import { useCategoryNotesScreen } from '@/hooks/use-category-notes-screen'
import { CategorySectionHeader } from '@/components/category-section-header'
import { isPlaceholderSectionItem } from '@/lib/utils/category-sections'
import NewNoteModal from '@/components/new-note-modal'
import NoteCard from '@/components/note-card'
import NoteDetailModal from '@/components/note-detail-modal'
import Fab from '@/components/ui/fab'
import QuickActionSheet from '@/components/ui/quick-action-sheet'

export default function UrgentScreen() {
  const { colors } = useAppTheme()
  const {
    collapsedSections,
    contexts,
    detailModalOpen,
    displaySections,
    doneActionHintHydrated,
    doneHintNoteId,
    dismissDoneActionHint,
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
    onSelectContext,
    refreshNotes,
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
  } = useCategoryNotesScreen('URGENT')

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.colorDanger} />
        </View>
      ) : (
        <>
          <SectionList
            sections={displaySections}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingTop: 24, paddingBottom: 100 }}
            style={styles.sectionList}
            showsVerticalScrollIndicator
            keyExtractor={(item: any) => item.id}
            renderItem={({ item, section }) => {
              if (isPlaceholderSectionItem(item)) return null

              return (
                <NoteCard
                  id={item.id}
                  title={item.title}
                  subtitle={section?.title}
                  reminderAt={item.initialReminderAt ?? undefined}
                  done={item.status === 'DONE'}
                  showDoneHint={
                    doneActionHintHydrated &&
                    !hasSeenDoneActionHint &&
                    item.status !== 'DONE' &&
                    item.id === firstUndoneNoteId
                  }
                  onDismissDoneHint={() => {
                    void dismissDoneActionHint()
                  }}
                  onPress={() => {
                    setSelectedNoteId(item.id)
                    setDetailModalOpen(true)
                  }}
                  onLongPress={() => {
                    setSelectedNoteId(item.id)
                    setSheetVisible(true)
                  }}
                  onToggleDone={() => handleMarkDone(item.id)}
                  swipeActions={[
                    {
                      text: 'Done',
                      backgroundColor: colors.colorSuccess,
                      onPress: () => handleMarkDone(item.id),
                    },
                    {
                      text: 'Delete',
                      backgroundColor: colors.colorDanger,
                      onPress: () => handleDelete(item.id),
                    },
                  ]}
                />
              )
            }}
            renderSectionHeader={({ section }) => {
              const hasPending = section.data.some((note: any) => note.classificationStatus === 'pending')
              const isEditingSection = section.id === editingContextId

              return (
                <CategorySectionHeader
                  borderColor={colors.colorBorder}
                  collapsed={!!collapsedSections[section.id]}
                  count={sectionCounts[section.id] ?? 0}
                  hasPending={hasPending}
                  iconColor={colors.colorDanger}
                  inputColor={colors.colorPrimary}
                  isEditable={isEditableSection(section.id)}
                  isEditing={isEditingSection}
                  onChangeEditingName={setEditingContextName}
                  onCommitEdit={async () => {
                    if (editingContextId) {
                      await handleUpdateContext(editingContextId, editingContextName)
                    }
                  }}
                  onStartEdit={() => handleEditContext({ id: section.id, title: section.title })}
                  onToggle={() => {
                    if (!isEditingSection) {
                      toggleSection(section.id)
                    }
                  }}
                  sectionBackgroundColor={colors.colorBgMuted}
                  sectionId={section.id}
                  testIDBase={`section-header-${section.id}`}
                  title={isEditingSection ? editingContextName : section.title}
                  titleColor={colors.colorDanger}
                />
              )
            }}
            ListEmptyComponent={<Text style={{ padding: 12, color: colors.colorTextMuted }}>No notes</Text>}
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
            showDoneHint={shouldShowDoneHint && doneHintNoteId === selectedNoteId}
            onDismissDoneHint={dismissDoneHint}
            onClose={() => {
              setDetailModalOpen(false)
              setSelectedNoteId(null)
            }}
            onUpdate={refreshNotes}
          />

          <NewNoteModal visible={!!newNoteOpen} category="URGENT" onClose={() => setNewNoteOpen(false)} onCreated={() => setNewNoteOpen(false)} />
          <Fab testID="fab-urgent" onPress={() => setNewNoteOpen(true)} color={colors.colorDanger} />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 50 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionList: { flex: 1 },
})
