import { Palette } from '@/constants/palette'
import React from 'react'
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native'

type Props = {
  onPress: () => void
  testID?: string
  style?: ViewStyle
  color?: string
}

export const Fab: React.FC<Props> = ({ onPress, testID, style, color }) => {
  return (
    <Pressable style={[styles.wrapper, style]} onPress={onPress} testID={testID}>
      <View style={[styles.button, color ? { backgroundColor: color } : undefined]}>
        <Text style={styles.plus}>+</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    zIndex: 50,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Palette.colorPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  plus: {
    color: '#fff',
    fontSize: 36,
    lineHeight: 36,
    fontWeight: '600',
  },
})

export default Fab
