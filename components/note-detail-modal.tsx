import { Note, NotesRepo } from '@/lib/db/notes-repo'
import { NotificationManager } from '@/lib/services/notification-manager'
import { logger } from '@/lib/utils/logger'
import { DateTimeField } from '@/components/ui/date-time-field'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useAppTheme } from '@/hooks/use-app-theme'
import { useKeyboardOffset } from '@/hooks/use-keyboard-offset'
import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

type Props = {
  visible: boolean
  noteId: string | null
  onClose: () => void
  onUpdate?: () => void
  showDoneHint?: boolean
  onDismissDoneHint?: () => void
}

export default function NoteDetailModal({
  visible,
  noteId,
  onClose,
  onUpdate,
  showDoneHint = false,
  onDismissDoneHint,
}: Props) {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const { keyboardShift } = useKeyboardOffset()
  const [note, setNote] = useState<Note | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingBody, setEditingBody] = useState(false)

  // Reminder states
  const [reminderDate, setReminderDate] = useState<Date | null>(null)
  const [initialReminderDate, setInitialReminderDate] = useState<Date | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)

  const loadNote = useCallback(async () => {
    if (!noteId) return
    try {
      const n = await NotesRepo.getById(noteId)
      setNote(n)
      setTitleDraft(n?.title ?? '')
      setBodyDraft(n?.body ?? '')
      setEditingTitle(false)
      setEditingBody(false)

      // Load existing reminders
      if (n?.reminderAt) setReminderDate(new Date(n.reminderAt))
      if (n?.initialReminderAt) setInitialReminderDate(new Date(n.initialReminderAt))
      if (n?.dueDate) setDueDate(new Date(n.dueDate))
    } catch (err) {
      logger.error('Failed to load note', { noteId, err })
      Alert.alert('Error', 'Failed to load note')
    }
  }, [noteId])

  useEffect(() => {
    if (visible && noteId) {
      loadNote()
    }
  }, [visible, noteId, loadNote])

  const persistContentChanges = async () => {
    if (!note) return

    const nextTitle = titleDraft.trim()
    const nextBody = bodyDraft.trim()
    const previousTitle = note.title.trim()
    const previousBody = (note.body ?? '').trim()
    const hasChanged = nextTitle !== previousTitle || nextBody !== previousBody

    if (!hasChanged) return
    if (!nextTitle) {
      setTitleDraft(note.title)
      Alert.alert('Missing Title', 'Title cannot be empty.')
      return
    }

    try {
      if (note.status === 'DONE') {
        await NotificationManager.markNoteUndone(note.id)
      }

      await NotesRepo.updateContent(note.id, nextTitle, nextBody || null)
      setNote(current => current ? { ...current, title: nextTitle, body: nextBody || undefined, status: 'PENDING' } : current)
      onUpdate?.()
    } catch (err) {
      logger.error('Failed to update note content', { noteId: note.id, err })
      Alert.alert('Error', 'Failed to update note')
      setTitleDraft(note.title)
      setBodyDraft(note.body ?? '')
    }
  }

  const handleSaveReminder = async () => {
    if (!note) return

    try {
      if (note.status === 'DONE') {
        await NotificationManager.markNoteUndone(note.id)
      }

      if (note.category === 'URGENT') {
        if (!initialReminderDate && !dueDate) {
          Alert.alert('Missing Info', 'Please set at least a reminder time or a due date for urgent notes')
          return
        }

        if (initialReminderDate && dueDate && initialReminderDate >= dueDate) {
          Alert.alert('Invalid Dates', 'Reminder must be before due date')
          return
        }

        await NotesRepo.updateUrgentReminders(
          note.id,
          initialReminderDate ? initialReminderDate.getTime() : null,
          dueDate ? dueDate.getTime() : null
        )
        await NotificationManager.scheduleUrgentBatch(note.id, __DEV__)
        onClose()
      } else {
        // HAVE/NICE: single reminder
        if (!reminderDate) {
          Alert.alert('Missing Info', 'Please set a reminder time')
          return
        }

        await NotesRepo.updateReminder(note.id, reminderDate.getTime())
        await NotificationManager.scheduleSingleReminder(note.id, reminderDate.getTime())
        onClose()
      }

      onUpdate?.()
      loadNote() // Reload to show updated data
    } catch (err) {
      logger.error('Failed to save reminder', { err })
      Alert.alert('Error', 'Failed to save reminder')
    }
  }

  const handleMarkDone = async () => {
    if (!note) return

    try {
      await NotificationManager.markNoteDone(note.id)
      Alert.alert('Done', 'Note moved to Done and reminders cancelled.')
      onUpdate?.()
      onClose()
    } catch (err) {
      logger.error('Failed to mark done', { err })
      Alert.alert('Error', 'Failed to mark note as done')
    }
  }

  const handleClearReminder = async () => {
    if (!note) return

    Alert.alert(
      'Clear Reminder?',
      'This will cancel the scheduled reminder.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              if (note.status === 'DONE') {
                await NotificationManager.markNoteUndone(note.id)
              }

              if (note.category === 'URGENT') {
                await NotesRepo.updateUrgentReminders(note.id, null, null)
              } else {
                await NotesRepo.updateReminder(note.id, null)
              }
              await NotificationManager.cancelAllReminders(note.id)
              setReminderDate(null)
              setInitialReminderDate(null)
              setDueDate(null)
              Alert.alert('Cleared', 'Reminder cancelled')
              onUpdate?.()
              loadNote()
            } catch (err) {
              logger.error('Failed to clear reminder', { err })
              Alert.alert('Error', 'Failed to clear reminder')
            }
          },
        },
      ]
    )
  }

  if (!note) return null

  const isUrgent = note.category === 'URGENT'
  const hasReminder = isUrgent ? (!!initialReminderDate || !!dueDate) : !!reminderDate

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <Animated.View style={[styles.container, { backgroundColor: colors.colorBgMain, transform: [{ translateY: keyboardShift }] }]}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.colorBgMain }]} edges={['left', 'right', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.colorBorder, backgroundColor: colors.colorBgElevated }]}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={colors.colorPrimary} />
            <Text style={[styles.backText, { color: colors.colorPrimary }]}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleMarkDone} style={[styles.doneButton, { backgroundColor: colors.colorSuccess }]}>
            <Text style={[styles.doneButtonText, { color: colors.colorBgMain }]}>Mark Done</Text>
          </TouchableOpacity>
        </View>

        {showDoneHint && (
          <View style={[styles.doneHintWrap, { backgroundColor: colors.colorBgElevated, borderBottomColor: colors.colorBorder }]}>
            <View style={[styles.doneHint, { backgroundColor: colors.colorPrimarySoft, borderColor: colors.colorPrimary }]}>
              <Text style={[styles.doneHintText, { color: colors.colorTextMain }]}>
                Tip: Tap Mark Done to silence the remaining reminders.
              </Text>
              <TouchableOpacity
                style={[styles.doneHintButton, { backgroundColor: colors.colorPrimary }]}
                onPress={onDismissDoneHint}
              >
                <Text style={[styles.doneHintButtonText, { color: colors.colorBgMain }]}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView style={[styles.content, { backgroundColor: colors.colorBgMain }]}>
          {/* Note Info */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.colorTextMuted }]}>Category</Text>
            <Text style={[styles.categoryBadge, { color: colors.colorPrimary, backgroundColor: colors.colorPrimarySoft }]}>{note.category}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.colorTextMuted }]}>Title</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setEditingTitle(true)}
              style={[
                styles.editableField,
                {
                  borderColor: editingTitle ? colors.colorPrimary : 'transparent',
                  backgroundColor: editingTitle ? colors.colorBgElevated : 'transparent',
                },
              ]}
            >
              <TextInput
                value={titleDraft}
                onChangeText={setTitleDraft}
                onFocus={() => setEditingTitle(true)}
                onBlur={async () => {
                  setEditingTitle(false)
                  await persistContentChanges()
                }}
                placeholder="Title"
                placeholderTextColor={colors.colorTextMuted}
                style={[styles.titleInput, { color: colors.colorTextMain }]}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.colorTextMuted }]}>Body</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setEditingBody(true)}
              style={[
                styles.editableField,
                styles.bodyField,
                {
                  borderColor: editingBody ? colors.colorPrimary : 'transparent',
                  backgroundColor: editingBody ? colors.colorBgElevated : 'transparent',
                },
              ]}
            >
              <TextInput
                value={bodyDraft}
                onChangeText={setBodyDraft}
                onFocus={() => setEditingBody(true)}
                onBlur={async () => {
                  setEditingBody(false)
                  await persistContentChanges()
                }}
                placeholder="Add details"
                placeholderTextColor={colors.colorTextMuted}
                multiline
                textAlignVertical="top"
                style={[styles.bodyInput, { color: colors.colorTextSecondary }]}
              />
            </TouchableOpacity>
          </View>

          {/* Reminder Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.colorTextMain }]}>Reminders</Text>
            {isUrgent ? (
              <>
                <DateTimeField
                  label="Initial Reminder"
                  value={initialReminderDate}
                  onChange={setInitialReminderDate}
                  minimumDate={new Date()}
                  mode="datetime"
                />
                <DateTimeField
                  label="Due Date"
                  value={dueDate}
                  onChange={setDueDate}
                  minimumDate={initialReminderDate || new Date()}
                  mode="datetime"
                  disabled={!initialReminderDate}
                />
              </>
            ) : (
              <DateTimeField
                label="Reminder Time"
                value={reminderDate}
                onChange={setReminderDate}
                minimumDate={new Date()}
                mode="datetime"
              />
            )}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.colorPrimary }]} onPress={handleSaveReminder}>
                <Text style={[styles.primaryButtonText, { color: colors.colorBgMain }]}>Save Reminder</Text>
              </TouchableOpacity>
              {hasReminder && (
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.colorDanger }]} onPress={handleClearReminder}>
                  <Text style={[styles.secondaryButtonText, { color: colors.colorDanger }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Status */}
          {note.status && note.status !== 'PENDING' && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.colorTextMuted }]}>Status</Text>
              <Text
                style={[
                  styles.statusBadge,
                  note.status === 'DONE'
                    ? [styles.statusDone, { color: colors.colorSuccess, backgroundColor: colors.colorSuccess + '22' }]
                    : [styles.statusExpired, { color: colors.colorDanger, backgroundColor: colors.colorDanger + '22' }],
                ]}
              >
                {note.status}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Date Pickers removed, now handled by DateTimeField */}
      </SafeAreaView>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 17,
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  doneButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  doneHintWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  doneHint: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  doneHintText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  doneHintButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  doneHintButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  categoryBadge: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  editableField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bodyField: {
    minHeight: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    padding: 0,
    margin: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  bodyInput: {
    minHeight: 96,
    fontSize: 16,
    lineHeight: 24,
    padding: 0,
    margin: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusDone: {},
  statusExpired: {},
})
