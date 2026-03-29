import { AppPalette } from '@/constants/palette'
import { useColorScheme } from '@/hooks/use-color-scheme'

export function useAppTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'

  return {
    scheme,
    isDark: scheme === 'dark',
    colors: AppPalette[scheme],
  }
}
