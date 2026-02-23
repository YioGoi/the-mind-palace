import { Note, NotesRepo } from '@/app/db/notes-repo'
import { NotificationManager } from '@/app/services/notification-manager'
import { logger } from '@/app/utils/logger'
import { DateTimeField } from '@/components/ui/date-time-field'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Palette } from '@/constants/palette'
import React, { useEffect, useState } from 'react'
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type Props = {
  visible: boolean
  noteId: string | null
  onClose: () => void
  onUpdate?: () => void
}

export default function NoteDetailModal({ visible, noteId, onClose, onUpdate }: Props) {
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Reminder states
  const [reminderDate, setReminderDate] = useState<Date | null>(null)
  const [initialReminderDate, setInitialReminderDate] = useState<Date | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)

  useEffect(() => {
    if (visible && noteId) {
      loadNote()
    }
  }, [visible, noteId])

  const loadNote = async () => {
    if (!noteId) return
    try {
      setLoading(true)
      const n = await NotesRepo.getById(noteId)
      setNote(n)
      
      // Load existing reminders
      if (n?.reminderAt) setReminderDate(new Date(n.reminderAt))
      if (n?.initialReminderAt) setInitialReminderDate(new Date(n.initialReminderAt))
      if (n?.dueDate) setDueDate(new Date(n.dueDate))
    } catch (err) {
      logger.error('Failed to load note', { noteId, err })
      Alert.alert('Error', 'Failed to load note')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveReminder = async () => {
    if (!note) return
    
    try {
      if (note.category === 'URGENT') {
        // URGENT: require both initialReminder and dueDate
        if (!initialReminderDate || !dueDate) {
          Alert.alert('Missing Info', 'Please set both reminder time and due date for urgent notes')
          return
        }
        
        if (initialReminderDate >= dueDate) {
          Alert.alert('Invalid Dates', 'Reminder must be before due date')
          return
        }
        
        await NotesRepo.updateUrgentReminders(note.id, initialReminderDate.getTime(), dueDate.getTime())
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
    
    Alert.alert(
      'Mark as Done?',
      'This will cancel all reminders for this note.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Done',
          style: 'destructive',
          onPress: async () => {
            try {
              await NotificationManager.markNoteDone(note.id)
              Alert.alert('Done!', 'Note marked as done and reminders cancelled')
              onUpdate?.()
              onClose()
            } catch (err) {
              logger.error('Failed to mark done', { err })
              Alert.alert('Error', 'Failed to mark note as done')
            }
          },
        },
      ]
    )
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
  const hasReminder = isUrgent ? (!!initialReminderDate && !!dueDate) : !!reminderDate

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={Palette.colorPrimary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          
          {isUrgent && (
            <TouchableOpacity onPress={handleMarkDone} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Mark Done</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content}>
          {/* Note Info */}
          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <Text style={styles.categoryBadge}>{note.category}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Title</Text>
            <Text style={styles.title}>{note.title}</Text>
          </View>

          {note.body && (
            <View style={styles.section}>
              <Text style={styles.label}>Body</Text>
              <Text style={styles.body}>{note.body}</Text>
            </View>
          )}

          {/* Reminder Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reminders</Text>
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
              <TouchableOpacity style={styles.primaryButton} onPress={handleSaveReminder}>
                <Text style={styles.primaryButtonText}>Save Reminder</Text>
              </TouchableOpacity>
              {hasReminder && (
                <TouchableOpacity style={styles.secondaryButton} onPress={handleClearReminder}>
                  <Text style={styles.secondaryButtonText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Status */}
          {note.status && note.status !== 'PENDING' && (
            <View style={styles.section}>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.statusBadge, note.status === 'DONE' ? styles.statusDone : styles.statusExpired]}>
                {note.status}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Date Pickers removed, now handled by DateTimeField */}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.colorBgMain,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Palette.colorBorder,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 17,
    color: Palette.colorPrimary,
  },
  doneButton: {
    backgroundColor: Palette.colorSuccess,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
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
    color: Palette.colorTextMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  categoryBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.colorPrimary,
    backgroundColor: Palette.colorPrimarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Palette.colorTextMain,
  },
  body: {
    fontSize: 16,
    color: Palette.colorTextSecondary,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.colorTextMain,
    marginBottom: 16,
  },
  dateButton: {
    backgroundColor: Palette.colorBgElevated,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.colorBorder,
    marginBottom: 12,
  },
  dateButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.colorTextSecondary,
    marginBottom: 4,
  },
  dateButtonValue: {
    fontSize: 16,
    color: Palette.colorTextMain,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Palette.colorPrimary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.colorDanger,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Palette.colorDanger,
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
  statusDone: {
    color: Palette.colorSuccess,
    backgroundColor: '#E8F7F0',
  },
  statusExpired: {
    color: Palette.colorDanger,
    backgroundColor: '#FFF1F1',
  },
})
