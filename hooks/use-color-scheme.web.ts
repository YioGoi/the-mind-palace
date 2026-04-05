import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useThemeStore } from '@/lib/store/theme-store'

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const preference = useThemeStore((state) => state.preference)

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'

  if (hasHydrated) {
    return colorScheme ?? 'light';
  }

  return 'light';
}
