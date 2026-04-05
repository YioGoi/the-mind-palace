import { useAppTheme } from '@/hooks/use-app-theme'
import React, { useCallback, useRef, useState } from 'react'
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAiAssistantStore } from '../lib/store/ai-assistant-store'
import { getAiCapabilities } from '../services/ai/config'
import { createNote } from '../lib/services/note-creator'
import { applyAiCleanupPlan, detectAssistantIntent, runAiAssistant } from '../services/ai-assistant/service'
import { AssistantMessage, CleanupPlan } from '../services/ai-assistant/types'
import {
  buildSelectedCleanupPlan,
  CLEANUP_DISMISS_MESSAGE,
  CLEANUP_EMPTY_SELECTION_MESSAGE,
  getInitialCleanupActionSelection,
  resolveAssistantOutcome,
  toggleCleanupActionSelection,
} from '../services/ai-assistant/modal-logic'

function newId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type Props = {
  visible: boolean
  onClose: () => void
}

export const AiAssistantModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors, isDark } = useAppTheme()
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [applyingCleanup, setApplyingCleanup] = useState(false)
  const [pendingCleanupPlan, setPendingCleanupPlan] = useState<CleanupPlan | null>(null)
  const [selectedCleanupActions, setSelectedCleanupActions] = useState<number[]>([])
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const listRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)
  const prefill = useAiAssistantStore(state => state.prefill)
  const clearPrefill = useAiAssistantStore(state => state.clearPrefill)
  const aiCapabilities = getAiCapabilities()
  const premiumEnabled = aiCapabilities.premiumEnabled

  React.useEffect(() => {
    if (!visible || !prefill) return
    setInput(prefill)
    clearPrefill()
  }, [visible, prefill, clearPrefill])

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false))

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  React.useEffect(() => {
    if (!visible) return
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120)
  }, [messages, pendingCleanupPlan, visible])

  React.useEffect(() => {
    setSelectedCleanupActions(getInitialCleanupActionSelection(pendingCleanupPlan))
  }, [pendingCleanupPlan])

  const appendMessage = useCallback((role: AssistantMessage['role'], text: string) => {
    setMessages(prev => [...prev, { id: newId(), role, text }])
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    appendMessage('user', text)
    setLoading(true)
    const intent = detectAssistantIntent(text)

    try {
      if (!premiumEnabled) {
        await createNote({ title: text, category: 'HAVE', source: 'manual' })
        appendMessage(
          'assistant',
          'Premium AI is off right now, so I saved this as a regular note for you.'
        )
        return
      }

      const result = await runAiAssistant(text)
      const outcome = resolveAssistantOutcome(intent, result)

      if (outcome.kind === 'capture_degraded') {
        await createNote({ title: text, category: 'HAVE', source: 'manual' })
        appendMessage('assistant', outcome.message)
        return
      }

      if (outcome.kind === 'cleanup_degraded' || outcome.kind === 'cleanup_failed' || outcome.kind === 'generic_failed' || outcome.kind === 'cleanup_no_actions' || outcome.kind === 'capture_no_notes') {
        appendMessage('assistant', outcome.message)
        return
      }

      if (outcome.kind === 'cleanup_review') {
        setPendingCleanupPlan(outcome.plan)
        appendMessage('assistant', outcome.message)
        return
      }

      appendMessage('assistant', outcome.message)
      if (outcome.warnings.length > 0) {
        appendMessage('assistant', outcome.warnings.join('\n'))
      }
    } catch {
      appendMessage('assistant', 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [input, loading, appendMessage, premiumEnabled])

  const handleApplyCleanup = useCallback(async () => {
    if (!pendingCleanupPlan || applyingCleanup) return
    const selectedPlan = buildSelectedCleanupPlan(pendingCleanupPlan, selectedCleanupActions)

    if (selectedPlan.actions.length === 0) {
      appendMessage('assistant', CLEANUP_EMPTY_SELECTION_MESSAGE)
      return
    }

    setApplyingCleanup(true)
    try {
      const result = await applyAiCleanupPlan(selectedPlan)
      appendMessage('assistant', [result.summary, ...result.details].join('\n'))
      setPendingCleanupPlan(null)
    } catch {
      appendMessage('assistant', "I couldn't apply that cleanup plan right now.")
    } finally {
      setApplyingCleanup(false)
    }
  }, [appendMessage, applyingCleanup, pendingCleanupPlan, selectedCleanupActions])

  const toggleCleanupAction = useCallback((index: number) => {
    setSelectedCleanupActions((current) => toggleCleanupActionSelection(current, index))
  }, [])

  const handleCancelCleanup = useCallback(() => {
    setPendingCleanupPlan(null)
    appendMessage('assistant', CLEANUP_DISMISS_MESSAGE)
  }, [appendMessage])

  const handleClose = useCallback(() => {
    setMessages([])
    setInput('')
    setPendingCleanupPlan(null)
    onClose()
  }, [onClose])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.colorBgMain }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12,
              borderBottomColor: colors.colorDivider,
              backgroundColor: colors.colorBgElevated,
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.colorTextMain }]}>AI Assistant</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={[styles.closeText, { color: colors.colorTextSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          ListEmptyComponent={
            <Text style={[styles.emptyHint, { color: colors.colorTextMuted }]}>
              {premiumEnabled
                ? "Tell me what's on your mind and I'll organize it for you."
                : "Premium AI is off. You can still drop a quick note here and sort it manually."}
            </Text>
          }
          ListFooterComponent={
            pendingCleanupPlan ? (
              <View
                style={[
                  styles.cleanupReviewCard,
                  {
                    backgroundColor: colors.colorBgElevated,
                    borderColor: colors.colorBorder,
                  },
                ]}
              >
                <Text style={[styles.cleanupTitle, { color: colors.colorTextMain }]}>Cleanup review</Text>
                <Text style={[styles.cleanupSummary, { color: colors.colorTextSecondary }]}>
                  {pendingCleanupPlan.summary}
                </Text>
                <View style={styles.cleanupActionList}>
                  {pendingCleanupPlan.actions.map((action, index) => (
                    <TouchableOpacity
                      key={`${action.type}-${index}`}
                      style={[
                        styles.cleanupActionRow,
                        {
                          borderColor: selectedCleanupActions.includes(index) ? colors.colorPrimary : colors.colorBorder,
                          backgroundColor: selectedCleanupActions.includes(index)
                            ? colors.colorBgMuted
                            : colors.colorBgElevated,
                        },
                      ]}
                      onPress={() => toggleCleanupAction(index)}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.cleanupCheckbox,
                          {
                            borderColor: selectedCleanupActions.includes(index) ? colors.colorPrimary : colors.colorBorder,
                            backgroundColor: selectedCleanupActions.includes(index) ? colors.colorPrimary : 'transparent',
                          },
                        ]}
                      >
                        {selectedCleanupActions.includes(index) ? (
                          <Text style={[styles.cleanupCheckboxMark, { color: colors.colorBgMain }]}>✓</Text>
                        ) : null}
                      </View>
                      <View style={styles.cleanupActionCopy}>
                        <Text style={[styles.cleanupActionType, { color: colors.colorTextMain }]}>
                          {action.type.replace(/_/g, ' ')}
                        </Text>
                        <Text style={[styles.cleanupActionReason, { color: colors.colorTextSecondary }]}>
                          {action.reason}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.cleanupButtonRow}>
                  <TouchableOpacity
                    style={[
                      styles.cleanupSecondaryButton,
                      { borderColor: colors.colorBorder, backgroundColor: colors.colorBgMuted },
                    ]}
                    onPress={handleCancelCleanup}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cleanupSecondaryButtonText, { color: colors.colorTextMain }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.cleanupPrimaryButton,
                      { backgroundColor: colors.colorPrimary },
                      applyingCleanup && styles.sendBtnDisabled,
                    ]}
                    onPress={handleApplyCleanup}
                    disabled={applyingCleanup}
                    activeOpacity={0.8}
                  >
                    {applyingCleanup ? (
                      <ActivityIndicator size="small" color={colors.colorBgMain} />
                    ) : (
                      <Text style={[styles.cleanupPrimaryButtonText, { color: colors.colorBgMain }]}>
                        Apply selected
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                item.role === 'user'
                  ? { backgroundColor: colors.colorPrimary }
                  : null,
                item.role === 'assistant'
                  ? { backgroundColor: colors.colorBgElevated, borderColor: colors.colorBorder }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                  item.role === 'user' ? { color: isDark ? '#000000' : '#ffffff' } : null,
                  item.role === 'assistant' ? { color: colors.colorTextMain } : null,
                ]}
              >
                {item.text}
              </Text>
            </View>
          )}
        />

        {/* Input */}
        <View
          style={[
            styles.inputRow,
            {
              borderTopColor: colors.colorDivider,
              backgroundColor: colors.colorBgElevated,
              paddingBottom: keyboardVisible ? 6 : Math.max(insets.bottom - 10, 8),
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.textInput, {
              borderColor: colors.colorBorder,
              color: colors.colorTextMain,
              backgroundColor: colors.colorBgMuted,
            }]}
            value={input}
            onChangeText={setInput}
            placeholder="Tell me what's on your mind..."
            placeholderTextColor={colors.colorTextMuted}
            multiline
            onSubmitEditing={handleSend}
            blurOnSubmit
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.colorPrimary }, loading && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color={colors.colorBgMain} />
              : <Text style={[styles.sendText, { color: colors.colorBgMain }]}>→</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 8,
  },
  closeText: {
    fontSize: 17,
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
    paddingTop: 24,
  },
  emptyHint: {
    textAlign: 'center',
    marginTop: 60,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextUser: {
  },
  bubbleTextAssistant: {
  },
  cleanupReviewCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  cleanupTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cleanupSummary: {
    fontSize: 14,
    lineHeight: 20,
  },
  cleanupActionList: {
    gap: 10,
  },
  cleanupActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  cleanupCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cleanupCheckboxMark: {
    fontSize: 12,
    fontWeight: '700',
  },
  cleanupActionCopy: {
    flex: 1,
    gap: 4,
  },
  cleanupActionType: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cleanupActionReason: {
    fontSize: 13,
    lineHeight: 18,
  },
  cleanupButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cleanupSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanupSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cleanupPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanupPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendText: {
    fontSize: 20,
    fontWeight: '700',
  },
})
