import { AccessibilityInfo } from 'react-native'
import { useEffect, useState } from 'react'

export function useReducedMotion() {
  const [reducedMotionEnabled, setReducedMotionEnabled] = useState(false)

  useEffect(() => {
    let active = true

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReducedMotionEnabled(enabled)
      })
      .catch(() => {
        if (active) setReducedMotionEnabled(false)
      })

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReducedMotionEnabled(enabled)
    })

    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return reducedMotionEnabled
}
