import { useAppTheme } from '@/hooks/use-app-theme'
import React from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Context = { id: string; name: string }

type Props = {
  visible: boolean
  contexts: Context[]
  onClose: () => void
  onSelect: (contextId: string) => void
}

export const QuickActionSheet: React.FC<Props> = ({ visible, contexts, onClose, onSelect }) => {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.colorBgElevated,
              borderTopColor: colors.colorBorder,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.colorTextMain }]}>Move note to...</Text>
          <FlatList
            data={contexts}
            keyExtractor={(i) => i.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, { borderBottomColor: colors.colorDivider }]}
                onPress={() => onSelect(item.id)}
                testID={`context-${item.id}`}
              >
                <Text style={{ color: colors.colorTextMain }}>{item.name}</Text>
              </Pressable>
            )}
          />
          <Pressable style={[styles.close, { marginBottom: insets.bottom > 0 ? 4 : 0 }]} onPress={onClose}>
            <Text style={{ color: colors.colorLink, fontWeight: '600' }}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: 1,
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '50%',
    overflow: 'hidden',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  close: {
    marginTop: 16,
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
})

export default QuickActionSheet
