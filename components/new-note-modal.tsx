import NewNoteReminderSheet from '@/components/new-note-reminder-sheet'
import { ThemedText } from '@/components/themed-text'
import { useAppTheme } from '@/hooks/use-app-theme'
import { useKeyboardOffset } from '@/hooks/use-keyboard-offset'
import { getAiCapabilities } from '@/services/ai/config'
import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ContextsRepo } from '../lib/db/contexts-repo'
import { NotesRepo } from '../lib/db/notes-repo'
import { createNote } from '../lib/services/note-creator'
import { NotificationManager } from '../lib/services/notification-manager'
import { useNotesStore } from '../lib/store/notes-store'
import { logger } from '../lib/utils/logger'

type Props = {
  visible: boolean
  category: string
  onClose: () => void
  onCreated?: (note: any) => void
}

type NoteCategory = 'HAVE' | 'URGENT' | 'NICE'
type ReminderSheetTarget = 'reminder' | 'due'
type ModalStep = 1 | 2

function formatDateTimeLabel(value: Date | null) {
  if (!value) return null
  return value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatReminderSummary(value: Date | null) {
  const label = formatDateTimeLabel(value)
  return label ? `Reminder: ${label}` : 'Set Reminder'
}

function formatDueSummary(value: Date | null) {
  const label = formatDateTimeLabel(value)
  return label ? `Due: ${label}` : 'Set Due Date'
}

export const NewNoteModal: React.FC<Props> = ({ visible, onClose, category, onCreated }) => {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { colors } = useAppTheme()
  const aiCapabilities = getAiCapabilities()
  const premiumEnabled = aiCapabilities.premiumEnabled
  const newContextInputRef = useRef<TextInput | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [contextName, setContextName] = useState('')
  const [loading, setLoading] = useState(false)
  const [reminderDate, setReminderDate] = useState<Date | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [reminderSheetVisible, setReminderSheetVisible] = useState(false)
  const [reminderSheetTarget, setReminderSheetTarget] = useState<ReminderSheetTarget>('reminder')
  const [contexts, setContexts] = useState<{ id: string; name: string }[]>([])
  const [selectedExistingContextId, setSelectedExistingContextId] = useState<string | null>(null)
  const [isCreatingNewContext, setIsCreatingNewContext] = useState(false)
  const [renderModal, setRenderModal] = useState(visible)
  const [step, setStep] = useState<ModalStep>(1)
  const { keyboardShift, keyboardVisible } = useKeyboardOffset()

  const backdropOpacity = useState(() => new Animated.Value(visible ? 1 : 0))[0]
  const panelTranslateY = useState(() => new Animated.Value(visible ? 0 : 28))[0]
  const panelOpacity = useState(() => new Animated.Value(visible ? 1 : 0.98))[0]

  const requiresManualContextSelection = !premiumEnabled
  const noteCategory = category as NoteCategory
  const normalizedContextName = contextName.trim()

  const panelTopInset = Math.max(insets.top + 10, 18)
  const panelBottomInset = 10
  const availablePanelHeight = Math.max(windowHeight - panelTopInset - panelBottomInset, 320)

  const stepOneHeight = keyboardVisible
    ? Math.min(Math.max(availablePanelHeight * 0.54, 360), 500)
    : Math.min(Math.max(availablePanelHeight * 0.64, 460), 620)
  const stepTwoHeight = keyboardVisible
    ? Math.min(Math.max(availablePanelHeight * 0.58, 400), 560)
    : Math.min(Math.max(availablePanelHeight * 0.72, 500), 760)
  const panelHeight = step === 1 ? stepOneHeight : stepTwoHeight

  const bodyHeight = step === 1
    ? Math.max(
      keyboardVisible ? 150 : 220,
      Math.min(keyboardVisible ? panelHeight * 0.33 : panelHeight * 0.42, keyboardVisible ? 240 : 340)
    )
    : Math.max(120, Math.min(panelHeight * 0.22, 180))

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

    setStep(1)
    loadContexts()
  }, [visible, category])

  useEffect(() => {
    if (visible) {
      setRenderModal(true)
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(panelTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(panelOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start()
      return
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(panelTranslateY, {
        toValue: 24,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(panelOpacity, {
        toValue: 0.98,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setRenderModal(false)
    })
  }, [visible, backdropOpacity, panelOpacity, panelTranslateY])

  useEffect(() => {
    if (!visible || !isCreatingNewContext) return
    const timer = setTimeout(() => {
      newContextInputRef.current?.focus()
    }, 90)
    return () => clearTimeout(timer)
  }, [visible, isCreatingNewContext])

  function resetForm() {
    setTitle('')
    setBody('')
    setContextName('')
    setSelectedExistingContextId(null)
    setIsCreatingNewContext(false)
    setReminderDate(null)
    setDueDate(null)
    setStep(1)
  }

  function handleClose() {
    Keyboard.dismiss()
    onClose()
  }

  function handleBackgroundPress() {
    Keyboard.dismiss()
  }

  function goToDetails() {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please provide a title for the note')
      return
    }
    Keyboard.dismiss()
    setStep(2)
  }

  function openReminderSheet(target: ReminderSheetTarget = 'reminder') {
    setReminderSheetTarget(target)
    Keyboard.dismiss()
    const open = () => setReminderSheetVisible(true)
    if (Platform.OS === 'ios') {
      setTimeout(open, 180)
      return
    }
    open()
  }

  function startCreatingNewContext() {
    setSelectedExistingContextId(null)
    setIsCreatingNewContext(true)
  }

  function confirmNewContext() {
    const nextName = contextName.trim()
    if (!nextName) {
      setIsCreatingNewContext(false)
      setContextName('')
      Keyboard.dismiss()
      return
    }

    setContextName(nextName)
    setSelectedExistingContextId(null)
    setIsCreatingNewContext(false)
    Keyboard.dismiss()
  }

  function cancelNewContext() {
    setIsCreatingNewContext(false)
    setContextName('')
    Keyboard.dismiss()
  }

  async function onCreate() {
    if (loading) return
    if (!title.trim()) {
      Alert.alert('Title required', 'Please provide a title for the note')
      setStep(1)
      return
    }

    setLoading(true)
    try {
      if (noteCategory === 'URGENT' && reminderDate && dueDate) {
        if (reminderDate >= dueDate) {
          Alert.alert('Invalid Dates', 'Reminder must be before due date')
          setLoading(false)
          return
        }
      }

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

      const note = await createNote({
        title: title.trim(),
        body: body.trim() || undefined,
        category: noteCategory,
        contextId: requiresManualContextSelection ? resolvedContextId : null,
        autoClassify: aiCapabilities.canAutoClassifyNotes,
      })

      let reminderSchedulingFailed = false

      try {
        if (noteCategory === 'URGENT' && (reminderDate || dueDate)) {
          await NotesRepo.updateUrgentReminders(
            note.id,
            reminderDate ? reminderDate.getTime() : null,
            dueDate ? dueDate.getTime() : null
          )
          await NotificationManager.scheduleUrgentBatch(note.id, __DEV__)
        } else if (reminderDate) {
          await NotesRepo.updateReminder(note.id, reminderDate.getTime())
          await NotificationManager.scheduleSingleReminder(note.id, reminderDate.getTime())
        }
      } catch (reminderError) {
        reminderSchedulingFailed = true
        logger.error('Reminder scheduling failed after note creation', {
          noteId: note.id,
          err: reminderError,
        })
      }

      await useNotesStore.getState().loadNotes(category)
      onCreated?.(note)
      resetForm()
      onClose()

      if (reminderSchedulingFailed) {
        Alert.alert('Reminder issue', 'Note created, but reminders could not be scheduled.')
      }
    } catch (e) {
      logger.error('Failed creating note', { err: e })
      Alert.alert('Failed', 'Could not create note')
    } finally {
      setLoading(false)
    }
  }

  if (!renderModal) return null

  return (
    <Modal visible={renderModal} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <View style={styles.keyboardShell}>
          <Animated.View
            style={[
              styles.panel,
              {
                backgroundColor: colors.colorBgMain,
                paddingBottom: Math.max(insets.bottom - 4, 10),
                marginBottom: panelBottomInset,
                marginTop: panelTopInset,
                height: panelHeight,
                opacity: panelOpacity,
                transform: [
                  {
                    translateY:
                      Platform.OS === 'ios'
                        ? Animated.add(panelTranslateY, Animated.multiply(keyboardShift, 0.92))
                        : panelTranslateY,
                  },
                ],
              },
            ]}
          >
            <TouchableWithoutFeedback onPress={handleBackgroundPress} accessible={false}>
              <View style={styles.contentArea}>
                <View style={styles.header}>
                  <Text style={[styles.title, { color: colors.colorTextMain }]}>New note ({category})</Text>
                  <Text style={[styles.stepLabel, { color: colors.colorTextMuted }]}>
                    {step === 1 ? '1 of 2' : '2 of 2'}
                  </Text>
                </View>

                {step === 1 ? (
                  <View style={styles.stepContent}>
                    <TextInput
                      placeholder="Title"
                      placeholderTextColor={colors.colorTextMuted}
                      value={title}
                      onChangeText={setTitle}
                      style={[
                        styles.input,
                        styles.themeInput,
                        {
                          color: colors.colorTextMain,
                          borderColor: colors.colorBorder,
                          backgroundColor: colors.colorBgMuted,
                        },
                      ]}
                    />
                    <TextInput
                      placeholder="Body (optional)"
                      placeholderTextColor={colors.colorTextMuted}
                      value={body}
                      onChangeText={setBody}
                      style={[
                        styles.input,
                        styles.themeInput,
                        {
                          height: bodyHeight,
                          color: colors.colorTextMain,
                          borderColor: colors.colorBorder,
                          backgroundColor: colors.colorBgMuted,
                        },
                      ]}
                      multiline
                      scrollEnabled
                      textAlignVertical="top"
                    />
                    <View style={[styles.footer, { borderTopColor: colors.colorBorder }]}>
                      <View style={styles.buttons}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#eee' }]}
                          onPress={handleClose}
                          activeOpacity={0.8}
                          disabled={loading}
                        >
                          <ThemedText style={[styles.actionBtnText, { color: '#666' }]}>Cancel</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.colorAccent }]}
                          onPress={goToDetails}
                          activeOpacity={0.8}
                          disabled={!title.trim() || loading}
                        >
                          <ThemedText style={[styles.actionBtnText, { color: colors.colorBgMain }]}>Next</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.stepContent}>
                    {requiresManualContextSelection ? (
                      <View style={styles.contextSection}>
                        <Text style={[styles.sectionLabel, { color: colors.colorTextMain }]}>Context</Text>
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
                                      backgroundColor: selected ? colors.colorAccent : colors.colorBgMuted,
                                      borderColor: selected ? colors.colorAccent : colors.colorBorder,
                                    },
                                  ]}
                                  onPress={() => {
                                    setSelectedExistingContextId(context.id)
                                    setIsCreatingNewContext(false)
                                    setContextName('')
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={{ color: selected ? colors.colorBgMain : colors.colorTextMain, fontWeight: '600' }}>
                                    {context.name}
                                  </Text>
                                </TouchableOpacity>
                              )
                            })}
                          </View>
                        ) : null}

                        {!isCreatingNewContext ? (
                          <TouchableOpacity
                            style={[
                              styles.newContextTrigger,
                              {
                                borderColor: normalizedContextName ? colors.colorAccent : colors.colorBorder,
                                backgroundColor: colors.colorBgMuted,
                              },
                            ]}
                            onPress={startCreatingNewContext}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={{
                                color: normalizedContextName ? colors.colorTextMain : colors.colorAccent,
                                fontWeight: '700',
                              }}
                            >
                              {normalizedContextName ? `New Context: ${normalizedContextName}` : 'New Context'}
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
                              ref={newContextInputRef}
                              placeholder="Write a new context name"
                              placeholderTextColor={colors.colorTextMuted}
                              value={contextName}
                              onChangeText={setContextName}
                              style={[styles.newContextInput, { color: colors.colorTextMain }]}
                            />
                            <TouchableOpacity
                              style={[styles.newContextAction, { backgroundColor: colors.colorBgMain, borderColor: colors.colorBorder }]}
                              onPress={confirmNewContext}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: colors.colorAccent, fontWeight: '800' }}>OK</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.newContextAction, { backgroundColor: colors.colorBgMain, borderColor: colors.colorBorder }]}
                              onPress={cancelNewContext}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: colors.colorTextMuted, fontWeight: '800' }}>X</Text>
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

                    <View style={styles.reminderActions}>
                      <Text style={[styles.sectionLabel, { color: colors.colorTextMain }]}>Reminders</Text>
                      <View style={styles.reminderButtons}>
                        <TouchableOpacity
                          style={[
                            styles.reminderButton,
                            {
                              backgroundColor: colors.colorBgMuted,
                              borderColor: colors.colorBorder,
                            },
                          ]}
                          onPress={() => openReminderSheet('reminder')}
                          activeOpacity={0.85}
                        >
                          <ThemedText
                            type="defaultSemiBold"
                            style={{ color: reminderDate ? colors.colorTextMain : colors.colorTextMuted }}
                          >
                            {formatReminderSummary(reminderDate)}
                          </ThemedText>
                        </TouchableOpacity>

                        {noteCategory === 'URGENT' ? (
                          <TouchableOpacity
                            style={[
                              styles.reminderButton,
                              {
                                backgroundColor: colors.colorBgMuted,
                                borderColor: colors.colorBorder,
                              },
                            ]}
                            onPress={() => openReminderSheet('due')}
                            activeOpacity={0.85}
                          >
                            <ThemedText
                              type="defaultSemiBold"
                              style={{ color: dueDate ? colors.colorTextMain : colors.colorTextMuted }}
                            >
                              {formatDueSummary(dueDate)}
                            </ThemedText>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>

                    <View style={[styles.footer, { borderTopColor: colors.colorBorder }]}>
                      <View style={styles.buttons}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#eee' }]}
                          onPress={() => {
                            Keyboard.dismiss()
                            setStep(1)
                          }}
                          activeOpacity={0.8}
                          disabled={loading}
                        >
                          <ThemedText style={[styles.actionBtnText, { color: '#666' }]}>Back</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.colorAccent }]}
                          onPress={onCreate}
                          activeOpacity={0.8}
                          disabled={loading}
                        >
                          <ThemedText style={[styles.actionBtnText, { color: colors.colorBgMain }]}>
                            {loading ? 'Creating...' : 'Create'}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </View>
      </Animated.View>

      <NewNoteReminderSheet
        visible={reminderSheetVisible}
        category={noteCategory}
        target={reminderSheetTarget}
        initialReminderDate={reminderDate}
        initialDueDate={dueDate}
        onCancel={() => setReminderSheetVisible(false)}
        onClear={(target) => {
          if (target === 'due') {
            setDueDate(null)
          } else {
            setReminderDate(null)
            if (noteCategory === 'URGENT') setDueDate(null)
          }
          setReminderSheetVisible(false)
        }}
        onConfirm={({ reminderDate: nextReminderDate, dueDate: nextDueDate }) => {
          setReminderDate(nextReminderDate)
          setDueDate(nextDueDate)
          setReminderSheetVisible(false)
        }}
      />
    </Modal>
  )
}

export default NewNoteModal

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  keyboardShell: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    paddingTop: 12,
    paddingHorizontal: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flexDirection: 'column',
  },
  contentArea: { flex: 1 },
  header: {
    marginBottom: 10,
    gap: 2,
  },
  title: { fontWeight: '700', fontSize: 16 },
  stepLabel: { fontSize: 12, fontWeight: '600' },
  stepContent: { flex: 1 },
  input: { borderWidth: 1, borderColor: '#eee', padding: 10, borderRadius: 6, marginBottom: 8, marginTop: 8 },
  themeInput: { minHeight: 46 },
  footer: {
    marginTop: 'auto',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
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
  sectionLabel: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  contextSection: {
    gap: 8,
    marginBottom: 12,
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
  newContextTrigger: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newContextInputWrap: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 46,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newContextInput: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 8,
  },
  newContextAction: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
  },
  contextHint: {
    fontSize: 12,
  },
  reminderActions: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 12,
  },
  reminderButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
})
