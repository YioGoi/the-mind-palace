import React from 'react'
import { Animated, Dimensions, Easing, Keyboard, KeyboardEvent, Platform } from 'react-native'

function getKeyboardHeight(event: KeyboardEvent) {
  const windowHeight = Dimensions.get('window').height
  return Math.max(0, windowHeight - event.endCoordinates.screenY)
}

export function useKeyboardOffset() {
  const keyboardShift = React.useRef(new Animated.Value(0)).current
  const [keyboardVisible, setKeyboardVisible] = React.useState(false)

  React.useEffect(() => {
    const animateTo = (height: number, duration?: number) => {
      Animated.timing(keyboardShift, {
        toValue: -height,
        duration: duration ?? 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    }

    if (Platform.OS === 'ios') {
      const changeSub = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
        const nextHeight = getKeyboardHeight(event)
        setKeyboardVisible(nextHeight > 0)
        animateTo(nextHeight, event.duration)
      })
      const hideSub = Keyboard.addListener('keyboardWillHide', (event) => {
        setKeyboardVisible(false)
        animateTo(0, event.duration)
      })

      return () => {
        changeSub.remove()
        hideSub.remove()
      }
    }

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      const nextHeight = getKeyboardHeight(event)
      setKeyboardVisible(nextHeight > 0)
      animateTo(nextHeight, 180)
    })
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false)
      animateTo(0, 180)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [keyboardShift])

  return { keyboardShift, keyboardVisible }
}
