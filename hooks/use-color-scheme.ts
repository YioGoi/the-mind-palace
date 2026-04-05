import { useColorScheme as useRNColorScheme } from 'react-native'
import { useThemeStore } from '@/lib/store/theme-store'

export function useColorScheme() {
  const systemScheme = useRNColorScheme()
  const preference = useThemeStore((state) => state.preference)

  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'
  return systemScheme ?? 'light'
}
