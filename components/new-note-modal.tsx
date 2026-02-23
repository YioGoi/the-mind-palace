import { ThemedText } from '@/components/themed-text'
import { Palette } from '@/constants/palette'
import DateTimePicker from '@react-native-community/datetimepicker'
import React, { useState } from 'react'
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { NotesRepo } from '../app/db/notes-repo'
import { NotificationManager } from '../app/services/notification-manager'
import { logger } from '../app/utils/logger'

type Props = {
  visible: boolean
  category: string
  onClose: () => void
  onCreated?: (note: any) => void
}

export const NewNoteModal: React.FC<Props> = ({ visible, onClose, category, onCreated }) => {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [reminderDate, setReminderDate] = useState<Date | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [showDuePicker, setShowDuePicker] = useState(false)

  async function onCreate() {
    if (loading) return
    if (!title.trim()) {
      Alert.alert('Title required', 'Please provide a title for the note')
      return
    }
    setLoading(true)
    try {
      // Create note first (no reminders yet)
      const note = await (await import('../app/services/note-creator')).createNote({
        title: title.trim(),
        body: body.trim() || undefined,
        category: category as 'HAVE' | 'URGENT' | 'NICE'
      })
      // Save reminders using NotesRepo and schedule notifications
      if (category === 'URGENT' && reminderDate && dueDate) {
        await NotesRepo.updateUrgentReminders(note.id, reminderDate!.getTime(), dueDate!.getTime())
        await NotificationManager.scheduleUrgentBatch(note.id, __DEV__)
      } else if (reminderDate) {
        await NotesRepo.updateReminder(note.id, reminderDate!.getTime())
        await NotificationManager.scheduleSingleReminder(note.id, reminderDate!.getTime())
      }
      onCreated?.(note)
      setTitle('')
      setBody('')
      setReminderDate(null)
      setDueDate(null)
      onClose()
    } catch (e) {
      logger.error('Failed creating note', { err: e })
      Alert.alert('Failed', 'Could not create note')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>New note ({category})</Text>
          <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.input} />
          <TextInput placeholder="Body (optional)" value={body} onChangeText={setBody} style={[styles.input, { height: 80 }]} multiline />
          {/* Reminder picker */}
          <TouchableOpacity
            style={[styles.input, { backgroundColor: '#f9f9f9', justifyContent: 'center' }]}
            onPress={() => setShowReminderPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#666' }}>
              {reminderDate ? `Reminder: ${reminderDate.toLocaleString()}` : 'Set Reminder'}
            </Text>
          </TouchableOpacity>
          {showReminderPicker && (
            <DateTimePicker
              value={reminderDate || new Date()}
              mode="datetime"
              display="default"
              onChange={(event, date) => {
                setShowReminderPicker(false)
                if (date) setReminderDate(date)
              }}
            />
          )}
          {/* Due date picker for urgent notes */}
          {category === 'URGENT' && (
            <TouchableOpacity
              style={[styles.input, { backgroundColor: '#f9f9f9', justifyContent: 'center' }]}
              onPress={() => setShowDuePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#666' }}>
                {dueDate ? `Due Date: ${dueDate.toLocaleString()}` : 'Set Due Date'}
              </Text>
            </TouchableOpacity>
          )}
          {category === 'URGENT' && showDuePicker && (
            <DateTimePicker
              value={dueDate || new Date()}
              mode="datetime"
              display="default"
              onChange={(event, date) => {
                setShowDuePicker(false)
                if (date) setDueDate(date)
              }}
            />
          )}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#eee' }]}
              onPress={onClose}
              activeOpacity={0.8}
              disabled={loading}
            >
              <ThemedText style={[styles.actionBtnText, { color: '#666' }]}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Palette.colorAccent }]}
              onPress={onCreate}
              activeOpacity={0.8}
              disabled={loading}
            >
              <ThemedText style={[styles.actionBtnText, { color: '#fff' }]}>{loading ? 'Creating...' : 'Create'}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  panel: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  title: { fontWeight: '700', marginBottom: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#eee', padding: 10, borderRadius: 6, marginBottom: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  actionBtnText: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.1,
  },
})

export default NewNoteModal
