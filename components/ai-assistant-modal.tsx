import { Palette } from '@/constants/palette'
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
import { isPremiumPlan } from '../services/ai/config'
import { createNote } from '../app/services/note-creator'
import { runAiAssistant } from '../services/ai-assistant/service'
import { AssistantMessage } from '../services/ai-assistant/types'

let msgCounter = 0
function newId() {
  return `msg-${++msgCounter}`
}

type Props = {
  visible: boolean
  onClose: () => void
}

export const AiAssistantModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const listRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)
  const premiumEnabled = isPremiumPlan()

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

      if (!result.ok && result.degrade) {
        await createNote({ title: text, category: 'HAVE', source: 'manual' })
        appendMessage(
          'assistant',
          'AI planning is temporarily unavailable, but your note has been saved.'
        )
        return
      }

      if (!result.ok) {
        appendMessage('assistant', "Sorry, I couldn't finish that request. Try rephrasing.")
        return
      }

      if (result.result.createdNotes.length === 0) {
        appendMessage('assistant', "Sorry, I couldn't find a note to create from that.")
        return
      }

      const summary = result.result.createdNotes.map(n => `• ${n.title}`).join('\n')
      const listWord = result.result.createdNotes.length === 1 ? 'note' : 'notes'
      appendMessage(
        'assistant',
        `${result.result.summary}\n\nCreated ${result.result.createdNotes.length} ${listWord}:\n${summary}`
      )
    } catch {
      appendMessage('assistant', 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [input, loading, appendMessage, premiumEnabled])

  const handleClose = useCallback(() => {
    setMessages([])
    setInput('')
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
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                item.role === 'assistant'
                  ? { backgroundColor: colors.colorBgElevated, borderColor: colors.colorBorder }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
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
            style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendText}>→</Text>
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
    backgroundColor: Palette.colorBgMain,
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
    justifyContent: 'flex-end',
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
    backgroundColor: Palette.colorPrimary,
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
    color: '#fff',
  },
  bubbleTextAssistant: {
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
    backgroundColor: Palette.colorPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
})
