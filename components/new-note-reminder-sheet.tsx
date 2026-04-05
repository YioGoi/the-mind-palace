import { ThemedText } from '@/components/themed-text'
import { useAppTheme } from '@/hooks/use-app-theme'
import DateTimePicker from '@react-native-community/datetimepicker'
import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Animated, Easing, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

type ReminderCategory = 'HAVE' | 'URGENT' | 'NICE'

type ReminderDraft = {
  reminderDate: Date | null
  dueDate: Date | null
}

type ReminderSheetTarget = 'reminder' | 'due'

type Props = {
  visible: boolean
  category: ReminderCategory
  target: ReminderSheetTarget
  initialReminderDate: Date | null
  initialDueDate: Date | null
  onCancel: () => void
  onConfirm: (draft: ReminderDraft) => void
  onClear?: (target: ReminderSheetTarget) => void
}

const FIVE_MINUTES_MS = 5 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

function roundToNextFiveMinutes(date: Date) {
  const rounded = new Date(date)
  rounded.setSeconds(0, 0)
  const minutes = rounded.getMinutes()
  const remainder = minutes % 5
  rounded.setMinutes(minutes + (remainder === 0 ? 5 : 5 - remainder))
  return rounded
}

function makeDefaultReminder() {
  return roundToNextFiveMinutes(new Date(Date.now() + FIVE_MINUTES_MS))
}

function makeDefaultDue(reminderDate: Date) {
  return new Date(reminderDate.getTime() + ONE_HOUR_MS)
}

function formatDateLabel(value: Date | null) {
  if (!value) return 'Not set'
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTimeLabel(value: Date | null) {
  if (!value) return 'Not set'
  return value.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function NewNoteReminderSheet({
  visible,
  category,
  target,
  initialReminderDate,
  initialDueDate,
  onCancel,
  onConfirm,
  onClear,
}: Props) {
  const { colors, isDark } = useAppTheme()
  const insets = useSafeAreaInsets()
  const [draftReminderDate, setDraftReminderDate] = useState<Date | null>(null)
  const [draftDueDate, setDraftDueDate] = useState<Date | null>(null)
  const [renderModal, setRenderModal] = useState(visible)
  const backdropOpacity = useState(() => new Animated.Value(visible ? 1 : 0))[0]
  const panelTranslateY = useState(() => new Animated.Value(visible ? 0 : 28))[0]
  const panelOpacity = useState(() => new Animated.Value(visible ? 1 : 0.98))[0]

  useEffect(() => {
    if (!visible) return

    const nextReminder = initialReminderDate ?? makeDefaultReminder()
    const nextDue = category === 'URGENT'
      ? initialDueDate ?? (target === 'due' ? makeDefaultDue(nextReminder) : null)
      : null

    setDraftReminderDate(nextReminder)
    setDraftDueDate(nextDue)
  }, [visible, category, initialReminderDate, initialDueDate, target])

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
      if (finished) {
        setRenderModal(false)
      }
    })
  }, [visible, backdropOpacity, panelOpacity, panelTranslateY])

  const hasExistingValue = target === 'due' ? Boolean(initialDueDate) : Boolean(initialReminderDate)

  const handleConfirm = () => {
    if (category === 'URGENT' && draftReminderDate && draftDueDate) {
      if (draftReminderDate >= draftDueDate) {
        Alert.alert('Invalid Dates', 'Reminder must be before due date')
        return
      }
    }

    onConfirm({
      reminderDate: draftReminderDate,
      dueDate: category === 'URGENT' ? draftDueDate : null,
    })
  }

  const reminderValue = useMemo(() => draftReminderDate ?? makeDefaultReminder(), [draftReminderDate])
  const dueValue = useMemo(
    () => draftDueDate ?? makeDefaultDue(draftReminderDate ?? makeDefaultReminder()),
    [draftDueDate, draftReminderDate]
  )
  const isDueTarget = target === 'due' && category === 'URGENT'
  const sheetTitle = isDueTarget ? 'Due Date' : 'Reminder'

  if (!renderModal) return null

  return (
    <Modal visible={renderModal} animationType="none" transparent onRequestClose={onCancel}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
          <Animated.View
            style={[
              styles.panel,
              {
                backgroundColor: colors.colorBgMain,
                paddingBottom: Math.max(insets.bottom - 4, 10),
                marginBottom: 10,
                marginTop: Math.max(insets.top + 10, 18),
                opacity: panelOpacity,
                transform: [{ translateY: panelTranslateY }],
              },
            ]}
          >
            <View style={[styles.header, { borderBottomColor: colors.colorBorder, backgroundColor: colors.colorBgElevated }]}>
              <TouchableOpacity onPress={onCancel} activeOpacity={0.8}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.colorTextSecondary }}>Cancel</ThemedText>
              </TouchableOpacity>
              <ThemedText type="defaultSemiBold">{sheetTitle}</ThemedText>
              <TouchableOpacity onPress={handleConfirm} activeOpacity={0.8}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.colorPrimary }}>Done</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
            >
              {!isDueTarget ? (
                <View style={[styles.card, { backgroundColor: colors.colorBgElevated, borderColor: colors.colorBorder }]}>
                  <ThemedText type="defaultSemiBold">Reminder</ThemedText>
                  <ThemedText style={{ color: colors.colorTextSecondary }}>
                    {`${formatDateLabel(draftReminderDate)} • ${formatTimeLabel(draftReminderDate)}`}
                  </ThemedText>
                  <View style={[styles.pickerSection, { borderColor: colors.colorBorder }]}>
                    <ThemedText style={{ paddingLeft: 14 }} type="defaultSemiBold">Date</ThemedText>
                    <DateTimePicker
                      value={reminderValue}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(_event, selectedDate) => {
                        if (selectedDate) {
                          setDraftReminderDate(selectedDate)
                        }
                      }}
                      minimumDate={new Date()}
                      textColor={colors.colorTextMain}
                      themeVariant={isDark ? 'dark' : 'light'}
                      style={styles.picker}
                    />
                  </View>
                  <View style={[styles.pickerSection, { borderColor: colors.colorBorder }]}>
                    <ThemedText style={{ paddingLeft: 14 }} type="defaultSemiBold">Time</ThemedText>
                    <DateTimePicker
                      value={reminderValue}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_event, selectedDate) => {
                        if (selectedDate) {
                          setDraftReminderDate(selectedDate)
                        }
                      }}
                      textColor={colors.colorTextMain}
                      themeVariant={isDark ? 'dark' : 'light'}
                      style={styles.picker}
                    />
                  </View>
                </View>
              ) : null}

              {isDueTarget ? (
                <View style={[styles.card, { backgroundColor: colors.colorBgElevated, borderColor: colors.colorBorder }]}>
                  <ThemedText type="defaultSemiBold">Due Date</ThemedText>
                  <ThemedText style={{ color: colors.colorTextSecondary }}>
                    {`${formatDateLabel(draftDueDate)} • ${formatTimeLabel(draftDueDate)}`}
                  </ThemedText>
                  <View style={[styles.pickerSection, { borderColor: colors.colorBorder }]}>
                    <ThemedText style={{ paddingLeft: 14 }} type="defaultSemiBold">Date</ThemedText>
                    <DateTimePicker
                      value={dueValue}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(_event, selectedDate) => {
                        if (selectedDate) setDraftDueDate(selectedDate)
                      }}
                      minimumDate={draftReminderDate ?? new Date()}
                      textColor={colors.colorTextMain}
                      themeVariant={isDark ? 'dark' : 'light'}
                      style={styles.picker}
                    />
                  </View>
                  <View style={[styles.pickerSection, { borderColor: colors.colorBorder }]}>
                    <ThemedText style={{ paddingLeft: 14 }} type="defaultSemiBold">Time</ThemedText>
                    <DateTimePicker
                      value={dueValue}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_event, selectedDate) => {
                        if (selectedDate) setDraftDueDate(selectedDate)
                      }}
                      textColor={colors.colorTextMain}
                      themeVariant={isDark ? 'dark' : 'light'}
                      style={styles.picker}
                    />
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.colorBorder, backgroundColor: colors.colorBgMain }]}>
              {hasExistingValue && onClear ? (
                <TouchableOpacity
                  style={[styles.clearButton, { borderColor: colors.colorDanger }]}
                  onPress={() => onClear(target)}
                  activeOpacity={0.85}
                >
                  <ThemedText type="defaultSemiBold" style={{ color: colors.colorDanger }}>
                    {isDueTarget ? 'Clear Due Date' : 'Clear Reminder'}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    flex: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 14,
    flexGrow: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  pickerSection: {
    borderWidth: 1,
    borderRadius: 14,
    paddingTop: 10,
    overflow: 'hidden',
  },
  picker: {
    alignSelf: 'stretch',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  clearButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
