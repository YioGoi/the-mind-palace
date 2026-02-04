import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { NotificationManager } from './services/notification-manager';
import { logger } from './utils/logger';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const appState = useRef<AppStateStatus | null>(null);
  const RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000 // 24h
  const router = useRouter()

  useEffect(() => {

    // Initialize notification system DB etc.
    NotificationManager.initNotificationSystem().catch((e) => logger.error('Failed to init notifications', { err: e }))

    // Reconcile on initial mount (cold start) using real NotesRepo
    import('./db/notes-repo').then(async (mod) => {
      await mod.NotesRepo.init()
      try {
        await NotificationManager.reconcile(
          RECONCILE_WINDOW_MS,
          async (id: string) => await mod.NotesRepo.getById(id),
          async () => await mod.NotesRepo.listAll(),
          __DEV__
        )
      } catch (e) {
        logger.error('Failed to reconcile on start', { err: e })
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
        // Use NotesRepo.getById for resume reconcile
        import('./db/notes-repo').then((mod) => {
          NotificationManager.reconcile(
            RECONCILE_WINDOW_MS,
            async (id) => await mod.NotesRepo.getById(id),
            async () => await mod.NotesRepo.listAll(),
            __DEV__
          ).catch((e) => logger.error('Failed to reconcile on resume', { err: e }))
        }).catch((e) => logger.error('Failed to load notes repo on resume', { err: e }))
      }
      appState.current = nextAppState
    }

    // Set current state and subscribe
    AppState.currentState && (appState.current = AppState.currentState)
    const sub = AppState.addEventListener('change', handler)

    return () => {
      sub.remove()
    }
  }, [router])

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
