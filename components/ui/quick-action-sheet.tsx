import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Context = { id: string; name: string }

type Props = {
  visible: boolean
  contexts: Context[]
  onClose: () => void
  onSelect: (contextId: string) => void
}

export const QuickActionSheet: React.FC<Props> = ({ visible, contexts, onClose, onSelect }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Move note to...</Text>
        <FlatList
          data={contexts}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => onSelect(item.id)} testID={`context-${item.id}`}>
              <Text>{item.name}</Text>
            </Pressable>
          )}
        />
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={{ color: '#007aff' }}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000088',
  },
  sheet: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '50%',
  },
  title: {
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  close: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
})

export default QuickActionSheet
