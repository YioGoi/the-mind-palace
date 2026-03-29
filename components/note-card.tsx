import { useAppTheme } from '@/hooks/use-app-theme'
import React from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable'

type SwipeAction = {
  text: string
  backgroundColor: string
  onPress: () => void
}

type Props = {
  id: string
  title: string
  subtitle?: string
  reminderAt?: number
  onLongPress?: () => void
  onPress?: () => void
  swipeActions?: SwipeAction[]
}

export const NoteCard: React.FC<Props> = ({ id, title, subtitle, reminderAt, onLongPress, onPress, swipeActions }) => {
  const { colors, isDark } = useAppTheme()
  // Format reminder date as 'Feb 12 - 13:00'
  const formatReminder = (timestamp?: number): string | undefined => {
    if (!timestamp) return undefined;
    const date = new Date(timestamp);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${month} ${day} - ${hour}:${minute}`;
  };
  const renderRightActions = () => {
    if (!swipeActions || swipeActions.length === 0) return null

    return (
      <View style={styles.swipeActionsContainer}>
        {swipeActions.map((action, index) => (
          <View key={index} style={[styles.swipeAction, { backgroundColor: action.backgroundColor }]}>
            <TouchableOpacity onPress={action.onPress} style={styles.swipeActionButton}>
              <Text style={styles.swipeActionText}>{action.text}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    )
  }

  const cardContent = (
    <Pressable style={styles.wrapper} onLongPress={onLongPress} onPress={onPress} testID={`note-card-${id}`}>
      <View style={[styles.container, {
        backgroundColor: colors.colorBgElevated,
        borderColor: colors.colorBorder,
        shadowOpacity: isDark ? 0 : 0.04,
      }]}>
        <Text style={[styles.title, { color: colors.colorTextMain }]}>{title}</Text>
        {reminderAt && (
          <Text style={[styles.subtitle, { color: colors.colorTextMuted }]}>{formatReminder(reminderAt)}</Text>
        )}
        {!reminderAt && subtitle && (
          <Text style={[styles.subtitle, { color: colors.colorTextMuted }]}>{subtitle}</Text>
        )}
      </View>
    </Pressable>
  )

  if (swipeActions && swipeActions.length > 0) {
    return (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        {cardContent}
      </Swipeable>
    )
  }

  return cardContent
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  container: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  swipeActionButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  swipeActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
})

export default NoteCard
