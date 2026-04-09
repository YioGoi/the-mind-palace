import { IconSymbol } from '@/components/ui/icon-symbol'
import React from 'react'
import { ActivityIndicator, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native'

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
  onDeleteContext: () => void
  onMoveContextCategory: () => void
  onStartEdit: () => void
  onToggle: () => void
  sectionBackgroundColor: string
  sectionId: string
  testIDBase: string
  title: string
  titleColor: string
  notice?: {
    message: string
    onDismiss: () => void
  } | null
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
  onDeleteContext,
  onMoveContextCategory,
  onStartEdit,
  onToggle,
  sectionBackgroundColor,
  sectionId,
  testIDBase,
  title,
  titleColor,
  notice,
}: Props) {
  const [menuVisible, setMenuVisible] = React.useState(false)
  const [menuAnchor, setMenuAnchor] = React.useState({ x: 0, y: 0 })
  const actionTriggerRef = React.useRef<any>(null)

  function openActionMenu() {
    actionTriggerRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      setMenuAnchor({
        x: x + width - 164,
        y: y + height + 8,
      })
      setMenuVisible(true)
    })
  }

  function closeActionMenu() {
    setMenuVisible(false)
  }

  function handleStartEdit() {
    closeActionMenu()
    onStartEdit()
  }

  function handleDelete() {
    closeActionMenu()
    onDeleteContext()
  }

  function handleMoveCategory() {
    closeActionMenu()
    onMoveContextCategory()
  }

  return (
    <View>
      {notice ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 6,
            backgroundColor: sectionBackgroundColor,
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              maxWidth: '92%',
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: '#1a1a1a',
              borderWidth: 1,
              borderColor,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18 }}>{notice.message}</Text>
            <TouchableOpacity onPress={notice.onDismiss} activeOpacity={0.7} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Text style={{ color: titleColor, fontSize: 12, fontWeight: '700' }}>Got it</Text>
            </TouchableOpacity>
            <View
              style={{
                position: 'absolute',
                left: 20,
                bottom: -7,
                width: 14,
                height: 14,
                backgroundColor: '#1a1a1a',
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        </View>
      ) : null}
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
            ref={actionTriggerRef}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            onPress={openActionMenu}
            activeOpacity={0.7}
            testID={`${testIDBase}-edit`}
          >
            <IconSymbol name="ellipsis" size={22} color={iconColor} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeActionMenu}>
        <Pressable style={{ flex: 1 }} onPress={closeActionMenu}>
          <View
            style={{
              position: 'absolute',
              top: menuAnchor.y,
              left: Math.max(12, menuAnchor.x),
              width: 164,
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: sectionBackgroundColor,
              borderWidth: 1,
              borderColor,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
            }}
          >
            <TouchableOpacity
              onPress={handleStartEdit}
              activeOpacity={0.75}
              style={{ paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: borderColor }}
              testID={`${testIDBase}-rename-action`}
            >
              <Text style={{ color: titleColor, fontSize: 14, fontWeight: '600' }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleMoveCategory}
              activeOpacity={0.75}
              style={{ paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: borderColor }}
              testID={`${testIDBase}-move-category-action`}
            >
              <Text style={{ color: titleColor, fontSize: 14, fontWeight: '600' }}>Move to category</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              activeOpacity={0.75}
              style={{ paddingHorizontal: 14, paddingVertical: 13 }}
              testID={`${testIDBase}-delete-action`}
            >
              <Text style={{ color: '#d96b63', fontSize: 14, fontWeight: '600' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}
