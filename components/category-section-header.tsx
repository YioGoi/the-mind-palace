import { IconSymbol } from '@/components/ui/icon-symbol'
import React from 'react'
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native'

type Props = {
  borderColor: string
  collapsed: boolean
  count: number
  hasPending: boolean
  iconColor: string
  inputColor: string
  isEditable: boolean
  isEditing: boolean
  onChangeEditingName: (value: string) => void
  onCommitEdit: () => Promise<void> | void
  onStartEdit: () => void
  onToggle: () => void
  sectionBackgroundColor: string
  sectionId: string
  testIDBase: string
  title: string
  titleColor: string
}

export function CategorySectionHeader({
  borderColor,
  collapsed,
  count,
  hasPending,
  iconColor,
  inputColor,
  isEditable,
  isEditing,
  onChangeEditingName,
  onCommitEdit,
  onStartEdit,
  onToggle,
  sectionBackgroundColor,
  sectionId,
  testIDBase,
  title,
  titleColor,
}: Props) {
  return (
    <View
      style={{
        padding: 12,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: sectionBackgroundColor,
        borderBottomColor: borderColor,
      }}
    >
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
        onPress={onToggle}
        activeOpacity={0.7}
        testID={testIDBase}
      >
        <IconSymbol
          name="rectangle.portrait.and.arrow.forward"
          size={22}
          color={iconColor}
          style={{ marginRight: 16, transform: [{ rotate: collapsed ? '0deg' : '90deg' }] }}
        />
        {isEditing ? (
          <TextInput
            value={title}
            onChangeText={onChangeEditingName}
            onBlur={onCommitEdit}
            onSubmitEditing={onCommitEdit}
            autoFocus
            style={{ fontSize: 16, fontWeight: '700', color: inputColor, flex: 1 }}
          />
        ) : (
          <Text style={{ fontSize: 16, fontWeight: '700', color: titleColor }}>
            {title}
          </Text>
        )}
        {hasPending ? (
          <View style={{ marginLeft: 8, transform: [{ translateY: 2 }] }}>
            <ActivityIndicator size="small" color={iconColor} />
          </View>
        ) : count ? (
          <Text style={{ fontSize: 14, opacity: 0.85, color: titleColor }}> ({count})</Text>
        ) : null}
      </TouchableOpacity>
      {isEditable ? (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          onPress={onStartEdit}
          activeOpacity={0.7}
          testID={`${testIDBase}-edit`}
        >
          <IconSymbol name="ellipsis" size={22} color={iconColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
