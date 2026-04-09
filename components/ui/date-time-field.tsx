import { useAppTheme } from '@/hooks/use-app-theme'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import React, { useEffect, useState } from 'react'
import { Animated, Easing, Keyboard, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export type DateTimeFieldProps = {
  label: string
  value: Date | null
  onChange: (date: Date | null) => void
  minimumDate?: Date
  maximumDate?: Date
  mode?: 'date' | 'time' | 'datetime'
  disabled?: boolean
  testID?: string
}

export const DateTimeField: React.FC<DateTimeFieldProps> = ({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  mode = 'datetime',
  disabled = false,
  testID,
}) => {
  const { colors, isDark } = useAppTheme()
  const [show, setShow] = useState(false)
  const [tempDate, setTempDate] = useState<Date>(value || new Date())
  const [renderModal, setRenderModal] = useState(false)
  const backdropOpacity = useState(() => new Animated.Value(0))[0]
  const panelTranslateY = useState(() => new Animated.Value(20))[0]
  const panelOpacity = useState(() => new Animated.Value(0.98))[0]

  const formatted = value
    ? `${value.getDate().toString().padStart(2, '0')} ${value.toLocaleString('default', { month: 'short' })} ${value.getFullYear()}, ${value.getHours().toString().padStart(2, '0')}:${value.getMinutes().toString().padStart(2, '0')}`
    : 'Not set'

  const openPicker = () => {
    Keyboard.dismiss()
    setTempDate(value || new Date())
    setShow(true)
  }

  const closePicker = () => setShow(false)

  const handleConfirm = () => {
    setShow(false)
    onChange(tempDate)
  }

  const handleCancel = () => {
    setShow(false)
    setTempDate(value || new Date())
  }

  // For Android, use native dialog
  const handleAndroidChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate) {
      setShow(false)
      onChange(selectedDate)
    } else {
      setShow(false)
    }
  }

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    if (show) {
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
          duration: 240,
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
        toValue: 20,
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
  }, [show, backdropOpacity, panelOpacity, panelTranslateY])

  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, { color: colors.colorTextSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.valueButton,
          {
            backgroundColor: colors.colorBgElevated,
            borderColor: colors.colorBorder,
          },
          disabled && styles.disabled,
        ]}
        onPress={openPicker}
        disabled={disabled}
        testID={testID}
      >
        <Text style={[styles.valueText, { color: colors.colorTextMain }]}>{formatted}</Text>
      </TouchableOpacity>
      {renderModal && Platform.OS === 'ios' && (
        <Modal
          visible={renderModal}
          animationType="none"
          transparent
          onRequestClose={closePicker}
        >
          <Animated.View style={[styles.modalRoot, { opacity: backdropOpacity }]}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closePicker} />
            <Animated.View
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.colorBgElevated,
                  opacity: panelOpacity,
                  transform: [{ translateY: panelTranslateY }],
                },
              ]}
            >
              <DateTimePicker
                value={tempDate}
                mode={mode}
                display="spinner"
                onChange={(_e, d) => d && setTempDate(d)}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={{ backgroundColor: colors.colorBgElevated }}
                textColor={colors.colorTextMain}
                themeVariant={isDark ? 'dark' : 'light'}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.colorBgMuted }]} onPress={handleCancel}>
                  <Text style={[styles.cancelText, { color: colors.colorTextSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmButton, { backgroundColor: colors.colorPrimary }]} onPress={handleConfirm}>
                  <Text style={[styles.confirmText, { color: colors.colorBgMain }]}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display="default"
          onChange={handleAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '600',
  },
  valueButton: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  valueText: {
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  cancelText: {
    fontWeight: '600',
    fontSize: 16,
  },
  confirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  confirmText: {
    fontWeight: '600',
    fontSize: 16,
  },
})
