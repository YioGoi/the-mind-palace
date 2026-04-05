import { IconSymbol } from '@/components/ui/icon-symbol'
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
  done?: boolean
  onLongPress?: () => void
  onPress?: () => void
  onToggleDone?: () => void
  showDoneHint?: boolean
  onDismissDoneHint?: () => void
  swipeActions?: SwipeAction[]
}

export const NoteCard: React.FC<Props> = ({
  id,
  title,
  subtitle,
  reminderAt,
  done = false,
  onLongPress,
  onPress,
  onToggleDone,
  showDoneHint = false,
  onDismissDoneHint,
  swipeActions,
}) => {
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
    <Pressable
      style={[styles.wrapper, showDoneHint ? styles.wrapperRaised : null]}
      onLongPress={onLongPress}
      onPress={onPress}
      testID={`note-card-${id}`}
    >
      <View style={[styles.container, {
        backgroundColor: colors.colorBgElevated,
        borderColor: colors.colorBorder,
        shadowOpacity: isDark ? 0 : 0.04,
      }]}>
        <View style={styles.contentRow}>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.colorTextMain }]}>{title}</Text>
            {reminderAt && (
              <Text style={[styles.subtitle, { color: colors.colorTextMuted }]}>{formatReminder(reminderAt)}</Text>
            )}
            {!reminderAt && subtitle && (
              <Text style={[styles.subtitle, { color: colors.colorTextMuted }]}>{subtitle}</Text>
            )}
          </View>

          {onToggleDone ? (
            <View style={styles.doneControl}>
              {showDoneHint ? (
                <View
                  style={[
                    styles.doneHintBubble,
                    {
                      backgroundColor: colors.colorFocus,
                      borderColor: colors.colorBorder,
                      shadowOpacity: isDark ? 0 : 0.08,
                    },
                  ]}
                >
                  <Text style={[styles.doneHintText, { color: colors.colorTextMain }]}>
                    Tap to mark done
                  </Text>
                  <View
                    style={[
                      styles.doneHintTail,
                      {
                        backgroundColor: colors.colorFocus,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={onDismissDoneHint}
                    hitSlop={8}
                    style={[styles.doneHintButton, { backgroundColor: colors.colorPrimarySoft }]}
                  >
                    <Text style={[styles.doneHintButtonText, { color: colors.colorPrimary }]}>Got it</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <TouchableOpacity
                onPress={onToggleDone}
                hitSlop={10}
                style={[
                  styles.doneButton,
                  {
                    borderColor: done ? colors.colorSuccess : colors.colorBorder,
                    backgroundColor: done ? colors.colorSuccess : colors.colorBgMuted,
                  },
                ]}
              >
                <IconSymbol
                  name={done ? 'checkmark.circle.fill' : 'circle'}
                  size={20}
                  color={done ? colors.colorBgMain : colors.colorTextMuted}
                />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
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
    position: 'relative',
  },
  wrapperRaised: {
    zIndex: 20,
    elevation: 20,
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
  },
  doneControl: {
    position: 'relative',
    alignItems: 'center',
  },
  doneButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  doneHintBubble: {
    position: 'absolute',
    right: 42,
    top: -11,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 148,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    zIndex: 2,
  },
  doneHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  doneHintTail: {
    position: 'absolute',
    right: -6,
    top: 16,
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
  },
  doneHintButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  doneHintButtonText: {
    fontSize: 11,
    fontWeight: '700',
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
