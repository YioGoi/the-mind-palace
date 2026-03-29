import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette } from '@/constants/palette';
import { AppFontFamilies } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { AiAssistantModal } from '../components/ai-assistant-modal';
import { isPremiumPlan } from '../services/ai/config';
import { NotificationManager } from './services/notification-manager';
import { useThemeStore } from './store/theme-store';
import { logger } from './utils/logger';

export const unstable_settings = {
  anchor: '(tabs)',
};

const styles = StyleSheet.create({
  aiButton: {
    position: 'absolute',
    top: 80,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.colorPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: AppFontFamilies.bold,
    letterSpacing: 0.5,
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { colors } = useAppTheme()
  const pathname = usePathname()
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const initializeTheme = useThemeStore(state => state.initialize)
  const devAiPlanOverride = useThemeStore(state => state.devAiPlanOverride)
  const appState = useRef<AppStateStatus | null>(null);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const router = useRouter()
  const premiumEnabled = isPremiumPlan()
  const hideAiButton = pathname === '/seed-contexts'

  useEffect(() => {
    if (hideAiButton && aiModalVisible) {
      setAiModalVisible(false)
    }
  }, [hideAiButton, aiModalVisible])

  useEffect(() => {
    initializeTheme().catch((e) => logger.error('Failed to initialize theme preference', { err: e }))

    // Initialize notification system DB etc.
    NotificationManager.initNotificationSystem().catch((e) => logger.error('Failed to init notifications', { err: e }))

    // Reconcile on initial mount (cold start)
    import('./db/notes-repo').then(async (mod) => {
      await mod.NotesRepo.init()
      try {
        await NotificationManager.reconcileUrgentNotes(__DEV__)
      } catch (e) {
        logger.error('Failed to reconcile on start', { err: e })
      }

      if (premiumEnabled) {
        try {
          const { reclassifyPendingNotes } = await import('../services/classification-pipeline')
          await reclassifyPendingNotes()
        } catch (e) {
          logger.error('Failed to reclassify pending notes', { err: e })
        }
      }

      // Check contexts; if none exist, route to seeding screen
      try {
        const ctxMod = await import('./db/contexts-repo')
        await ctxMod.ContextsRepo.init()
        const contexts = await ctxMod.ContextsRepo.listContexts()
        if (!contexts || contexts.length === 0) {
          logger.info('No contexts found; redirecting to seed screen')
          router.replace('/seed-contexts')
        }
      } catch (e) {
        logger.error('Failed to check contexts', { err: e })
      }
    }).catch((e) => logger.error('Failed to init notes repo or reconcile', { err: e }))

    const handler = (nextAppState: AppStateStatus) => {
      if (appState.current === 'active') {
        // going from active -> background, ignore
      }

      if (nextAppState === 'active') {
        logger.info('App resumed: running reconciliation')
        NotificationManager.reconcileUrgentNotes(__DEV__)
          .catch((e) => logger.error('Failed to reconcile on resume', { err: e }))
        if (premiumEnabled) {
          import('../services/classification-pipeline')
            .then(({ reclassifyPendingNotes }) => reclassifyPendingNotes())
            .catch((e) => logger.error('Failed to reclassify pending notes on resume', { err: e }))
        }
      }
      appState.current = nextAppState
    }

    // Set current state and subscribe
    AppState.currentState && (appState.current = AppState.currentState)
    const sub = AppState.addEventListener('change', handler)

    return () => {
      sub.remove()
    }
  }, [router, initializeTheme, devAiPlanOverride])

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>

      {/* Global AI button — floats above all screens */}
      {premiumEnabled && !hideAiButton ? (
        <TouchableOpacity
          style={styles.aiButton}
          onPress={() => setAiModalVisible(true)}
          activeOpacity={0.85}
        >
          <IconSymbol 
            size={28} 
            name="circle.hexagongrid.circle" 
            color={colorScheme === 'dark' ? colors.colorAccent : colors.colorBgMain} 
          />
        </TouchableOpacity>
      ) : null}

      {premiumEnabled && !hideAiButton ? (
        <AiAssistantModal
          visible={aiModalVisible}
          onClose={() => setAiModalVisible(false)}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}
