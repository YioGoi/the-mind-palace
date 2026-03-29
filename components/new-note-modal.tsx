import { ThemedText } from '@/components/themed-text'
import { Palette } from '@/constants/palette'
import { useAppTheme } from '@/hooks/use-app-theme'
import { isPremiumPlan } from '@/services/ai/config'
import DateTimePicker from '@react-native-community/datetimepicker'
import React, { useEffect, useState } from 'react'
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ContextsRepo } from '../app/db/contexts-repo'
import { NotesRepo } from '../app/db/notes-repo'
import { createNote } from '../app/services/note-creator'
import { NotificationManager } from '../app/services/notification-manager'
import { useNotesStore } from '../app/store/notes-store'
import { logger } from '../app/utils/logger'

type Props = {
  visible: boolean
  category: string
  onClose: () => void
  onCreated?: (note: any) => void
}

export const NewNoteModal: React.FC<Props> = ({ visible, onClose, category, onCreated }) => {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const premiumEnabled = isPremiumPlan()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [contextName, setContextName] = useState('')
  const [loading, setLoading] = useState(false)
  const [reminderDate, setReminderDate] = useState<Date | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [showDuePicker, setShowDuePicker] = useState(false)
  const [contexts, setContexts] = useState<Array<{ id: string; name: string }>>([])
  const [selectedExistingContextId, setSelectedExistingContextId] = useState<string | null>(null)
  const [isCreatingNewContext, setIsCreatingNewContext] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  const requiresManualContextSelection = !premiumEnabled

  useEffect(() => {
    if (!visible) return

    async function loadContexts() {
      try {
        await ContextsRepo.init()
        const allContexts = await ContextsRepo.listContexts()
        const filtered = allContexts.filter((context) => context.category === category)
        setContexts(filtered)
        setSelectedExistingContextId(null)
        setIsCreatingNewContext(false)
        setContextName('')
      } catch (err) {
        logger.error('Failed to load contexts for new note modal', { category, err })
      }
    }

    loadContexts()
  }, [visible, category])

  useEffect(() => {
    const showSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true))
      : Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hideSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false))
      : Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const normalizedContextName = contextName.trim()

  async function onCreate() {
    if (loading) return
    if (!title.trim()) {
      Alert.alert('Title required', 'Please provide a title for the note')
      return
    }
    setLoading(true)
    try {
      let resolvedContextId: string | null = null

      if (requiresManualContextSelection && selectedExistingContextId) {
        resolvedContextId = selectedExistingContextId
      } else if (requiresManualContextSelection && normalizedContextName) {
        const existingContext = contexts.find(
          (context) => context.name.trim().toLowerCase() === normalizedContextName.toLowerCase()
        )

        if (existingContext) {
          resolvedContextId = existingContext.id
        } else {
          await ContextsRepo.createContexts([normalizedContextName], category)
          const refreshedContexts = await ContextsRepo.listContexts()
          const filteredContexts = refreshedContexts.filter((context) => context.category === category)
          setContexts(filteredContexts)
          resolvedContextId =
            filteredContexts.find(
              (context) => context.name.trim().toLowerCase() === normalizedContextName.toLowerCase()
            )?.id ?? null
        }
      }

      logger.info('NEW_NOTE_MODAL create start', {
        category,
        title: title.trim(),
        hasBody: Boolean(body.trim()),
        requiresManualContextSelection,
        normalizedContextName,
        selectedExistingContextId,
        resolvedContextId,
      })

      const note = await createNote({
        title: title.trim(),
        body: body.trim() || undefined,
        category: category as 'HAVE' | 'URGENT' | 'NICE',
        contextId: requiresManualContextSelection ? resolvedContextId : null,
      })

      logger.info('NEW_NOTE_MODAL create success', {
        noteId: note.id,
        category: note.category,
        contextId: note.contextId ?? null,
        status: note.classificationStatus,
      })

      // Save reminders using NotesRepo and schedule notifications
      if (category === 'URGENT' && reminderDate && dueDate) {
        await NotesRepo.updateUrgentReminders(note.id, reminderDate!.getTime(), dueDate!.getTime())
        await NotificationManager.scheduleUrgentBatch(note.id, __DEV__)
      } else if (reminderDate) {
        await NotesRepo.updateReminder(note.id, reminderDate!.getTime())
        await NotificationManager.scheduleSingleReminder(note.id, reminderDate!.getTime())
      }

      await useNotesStore.getState().loadNotes(category)
      logger.info('NEW_NOTE_MODAL store reloaded', { category })

      onCreated?.(note)
      setTitle('')
      setBody('')
      setContextName('')
      setSelectedExistingContextId(null)
      setIsCreatingNewContext(false)
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
        <KeyboardAvoidingView
          style={styles.keyboardShell}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View
            style={[
              styles.panel,
              {
                backgroundColor: colors.colorBgMain,
                paddingBottom: keyboardVisible ? 4 : Math.max(insets.bottom - 22, 4),
                maxHeight: keyboardVisible ? '90%' : '82%',
                marginBottom: keyboardVisible ? 0 : 10,
                marginTop: keyboardVisible ? Math.max(insets.top + 10, 18) : undefined,
              },
            ]}
          >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.title, { color: colors.colorTextMain }]}>New note ({category})</Text>
            <TextInput
              placeholder="Title"
              placeholderTextColor={colors.colorTextMuted}
              value={title}
              onChangeText={setTitle}
              style={[styles.input, styles.themeInput, { color: colors.colorTextMain, borderColor: colors.colorBorder, backgroundColor: colors.colorBgMuted }]}
            />
            <TextInput
              placeholder="Body (optional)"
              placeholderTextColor={colors.colorTextMuted}
              value={body}
              onChangeText={setBody}
              style={[
                styles.input,
                styles.themeInput,
                { height: 80, color: colors.colorTextMain, borderColor: colors.colorBorder, backgroundColor: colors.colorBgMuted },
              ]}
              multiline
            />
            {requiresManualContextSelection ? (
              <View style={styles.contextSection}>
                <Text style={[styles.contextLabel, { color: colors.colorTextMain }]}>Context</Text>
                {contexts.length ? (
                  <View style={styles.contextChips}>
                    {contexts.map((context) => {
                      const selected = selectedExistingContextId === context.id
                      return (
                        <TouchableOpacity
                          key={context.id}
                          style={[
                            styles.contextChip,
                            {
                              backgroundColor: selected ? Palette.colorAccent : colors.colorBgMuted,
                              borderColor: selected ? Palette.colorAccent : colors.colorBorder,
                            },
                          ]}
                          onPress={() => {
                            setSelectedExistingContextId(context.id)
                            setIsCreatingNewContext(false)
                            setContextName('')
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: selected ? '#fff' : colors.colorTextMain, fontWeight: '600' }}>
                            {context.name}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                ) : null}
                {!isCreatingNewContext ? (
                  <TouchableOpacity
                    style={styles.newContextLink}
                    onPress={() => {
                      setIsCreatingNewContext(true)
                      setSelectedExistingContextId(null)
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: Palette.colorAccent, fontWeight: '600' }}>
                      Create a new context instead +
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {isCreatingNewContext ? (
                  <View
                    style={[
                      styles.newContextInputWrap,
                      { borderColor: colors.colorBorder, backgroundColor: colors.colorBgMuted },
                    ]}
                  >
                    <TextInput
                      placeholder="Write a new context name"
                      placeholderTextColor={colors.colorTextMuted}
                      value={contextName}
                      onChangeText={setContextName}
                      style={[styles.newContextInput, { color: colors.colorTextMain }]}
                    />
                    <TouchableOpacity
                      style={styles.newContextClose}
                      onPress={() => {
                        setIsCreatingNewContext(false)
                        setContextName('')
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: colors.colorTextMuted, fontWeight: '700' }}>X</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <Text style={[styles.contextHint, { color: colors.colorTextMuted }]}>
                  {selectedExistingContextId
                    ? 'The note will be added to the selected context.'
                    : normalizedContextName
                    ? 'A new context will be created with this name.'
                    : 'If you do not choose or create a context, the note will stay in Unsorted.'}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.input, styles.themeInput, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder, justifyContent: 'center' }]}
              onPress={() => setShowReminderPicker(true)}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.colorTextMuted }}>
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
            {category === 'URGENT' && (
              <TouchableOpacity
                style={[styles.input, styles.themeInput, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder, justifyContent: 'center' }]}
                onPress={() => setShowDuePicker(true)}
                activeOpacity={0.8}
              >
                <Text style={{ color: colors.colorTextMuted }}>
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
          </ScrollView>
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  keyboardShell: { justifyContent: 'flex-end' },
  panel: { padding: 10, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  scrollContent: { gap: 8, paddingBottom: 8 },
  title: { fontWeight: '700', marginBottom: 8, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#eee', padding: 10, borderRadius: 6, marginBottom: 8 },
  themeInput: { minHeight: 46 },
  contextSection: {
    marginBottom: 8,
    gap: 8,
  },
  contextChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newContextToggle: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  newContextLink: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  newContextInputWrap: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 46,
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  newContextInput: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 8,
  },
  newContextClose: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  contextLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
  },
  contextHint: {
    color: '#777',
    fontSize: 12,
  },
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
