import { Palette } from '@/constants/palette'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

type Props = {
  id: string
  title: string
  subtitle?: string // We will use this for enlarged cards later
  onLongPress?: () => void
  onPress?: () => void
}

export const NoteCard: React.FC<Props> = ({ id, title, onLongPress, onPress }) => {
  return (
    <Pressable style={styles.wrapper} onLongPress={onLongPress} onPress={onPress} testID={`note-card-${id}`}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  container: {
    backgroundColor: Palette.colorBgElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Palette.colorBorder,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.colorTextMain,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: Palette.colorTextMuted,
  },
})

export default NoteCard
