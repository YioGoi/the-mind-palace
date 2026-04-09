import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AiAssistantModal } from '../components/ai-assistant-modal';
import { PremiumUpgradeSheet } from '../components/premium-upgrade-sheet';
import { getOrCreateInstallId } from '../lib/services/install-id';
import { NotificationManager } from '../lib/services/notification-manager';
import { PremiumCleanupNudge } from '../lib/services/premium-cleanup-nudge';
import { useAiAssistantStore } from '../lib/store/ai-assistant-store';
import { useAiUpsellStore } from '../lib/store/ai-upsell-store';
import { useNotesStore } from '../lib/store/notes-store';
import { useThemeStore } from '../lib/store/theme-store';
import { getAiEntryVisibility } from '../lib/utils/ai-entry-visibility';
import { logger } from '../lib/utils/logger';
import { getAiCapabilities } from '../services/ai/config';

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
  aiTooltipWrap: {
    position: 'absolute',
    top: 74,
    right: 62,
    width: 222,
    zIndex: 998,
    alignItems: 'flex-start',
  },
  aiTooltipBubble: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  aiTooltipTailShadow: {
    position: 'absolute',
    right: -8,
    top: 17,
    width: 18,
    height: 18,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  aiTooltipTail: {
    position: 'absolute',
    right: -7,
    top: 18,
    width: 16,
    height: 16,
    borderTopWidth: 1,
    borderRightWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { colors, isDark } = useAppTheme()
  const pathname = usePathname()
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const initializeTheme = useThemeStore(state => state.initialize)
  const themeHydrated = useThemeStore(state => state.hydrated)
  const devAiPlanOverride = useThemeStore(state => state.devAiPlanOverride)
  const initializeUpsell = useAiUpsellStore(state => state.initialize)
  const initializeNotes = useNotesStore(state => state.initialize)
  const allNotes = useNotesStore(state => state.notes)
  const hasUnlockedAiRevealAt13 = useAiUpsellStore(state => state.hasUnlockedAiRevealAt13)
  const markAiRevealSeen = useAiUpsellStore(state => state.markAiRevealSeen)
  const appState = useRef<AppStateStatus | null>(null);
  const bootstrapped = useRef(false)
  const [premiumSheetVisible, setPremiumSheetVisible] = useState(false);
  const router = useRouter()
  const aiModalVisible = useAiAssistantStore(state => state.visible)
  const openAiAssistant = useAiAssistantStore(state => state.open)
  const closeAiAssistant = useAiAssistantStore(state => state.close)
  const aiCapabilities = themeHydrated ? getAiCapabilities() : null
  const premiumEnabled = aiCapabilities?.premiumEnabled ?? false
  const premiumEnabledRef = useRef(premiumEnabled)
  const aiUpsellMarketingEnabled = aiCapabilities?.marketingEnabled ?? false
  const hideAiButton = pathname === '/seed-contexts'
  const notesCreatedCount = allNotes.length
  const { freeAiVisible, showAiButton, showAiRevealTooltip } = getAiEntryVisibility({
    premiumEnabled,
    aiUpsellMarketingEnabled,
    notesCreatedCount,
    hasUnlockedAiRevealAt13,
    hideAiButton,
  })

  useEffect(() => {
    premiumEnabledRef.current = premiumEnabled
  }, [premiumEnabled])

  useEffect(() => {
    if (hideAiButton && aiModalVisible) {
      closeAiAssistant()
    }
    if (hideAiButton && premiumSheetVisible) {
      setPremiumSheetVisible(false)
    }
  }, [hideAiButton, aiModalVisible, closeAiAssistant, premiumSheetVisible])

  useEffect(() => {
    if (bootstrapped.current) {
      return
    }
    bootstrapped.current = true

    initializeTheme().catch((e) => logger.error('Failed to initialize theme preference', { err: e }))
    initializeUpsell().catch((e) => logger.error('Failed to initialize AI upsell state', { err: e }))
    initializeNotes().catch((e) => logger.error('Failed to initialize notes store', { err: e }))
    getOrCreateInstallId().catch((e) => logger.error('Failed to initialize install id', { err: e }))

    // Initialize notification system DB etc.
    NotificationManager.initNotificationSystem().catch((e) => logger.error('Failed to init notifications', { err: e }))

    // Reconcile on initial mount (cold start)
    import('../lib/db/notes-repo').then(async (mod) => {
      await mod.NotesRepo.init()
      try {
        await NotificationManager.reconcileUrgentNotes(__DEV__)
      } catch (e) {
        logger.error('Failed to reconcile on start', { err: e })
      }

      // Check contexts; if none exist, route to seeding screen
      try {
        const ctxMod = await import('../lib/db/contexts-repo')
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
        if (premiumEnabledRef.current) {
          PremiumCleanupNudge.schedule().catch((e) =>
            logger.error('Failed to schedule premium cleanup nudge on resume', { err: e })
          )
        }
        if (premiumEnabledRef.current) {
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
  }, [router, initializeTheme, initializeUpsell, initializeNotes])

  useEffect(() => {
    if (!premiumEnabled) {
      return
    }

    PremiumCleanupNudge.schedule().catch((e) =>
      logger.error('Failed to schedule premium cleanup nudge', { err: e })
    )

    import('../services/classification-pipeline')
      .then(({ reclassifyPendingNotes }) => reclassifyPendingNotes())
      .catch((e) => logger.error('Failed to reclassify pending notes', { err: e }))
  }, [premiumEnabled, devAiPlanOverride])

  function handleAiEntry() {
    if (premiumEnabled) {
      openAiAssistant()
      return
    }

    if (freeAiVisible) {
      void markAiRevealSeen()
      setPremiumSheetVisible(true)
    }
  }

  function handleStartPremium() {
    setPremiumSheetVisible(false)
    router.push('/settings')
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#080610' }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>

      {/* Global AI button — floats above all screens */}
      {showAiButton ? (
        <TouchableOpacity
          style={[styles.aiButton, { backgroundColor: isDark ? colors.colorFocus : colors.colorTextSecondary }]}
          onPress={handleAiEntry}
          activeOpacity={0.85}
        >
          <IconSymbol 
            size={28} 
            name="circle.hexagongrid.circle" 
            color={isDark ? colors.colorTextMain : colors.colorBgMain} 
          />
        </TouchableOpacity>
      ) : null}

      {showAiRevealTooltip ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleAiEntry}
          style={styles.aiTooltipWrap}
        >
          <View
            style={[
              styles.aiTooltipBubble,
              {
                backgroundColor: colors.colorBgElevated,
                borderColor: colors.colorBorder,
              },
            ]}
          >
            <ThemedText type="defaultSemiBold">Ready to let AI organize your notes?</ThemedText>
          </View>
          <View
            style={[
              styles.aiTooltipTailShadow,
              {
                backgroundColor: colors.colorBgElevated,
              },
            ]}
          />
          <View
            style={[
              styles.aiTooltipTail,
              {
                backgroundColor: colors.colorBgElevated,
                borderColor: colors.colorBorder,
              },
            ]}
          />
        </TouchableOpacity>
      ) : null}

      {premiumEnabled && !hideAiButton ? (
        <AiAssistantModal
          visible={aiModalVisible}
          onClose={closeAiAssistant}
          onRequirePremium={() => setPremiumSheetVisible(true)}
        />
      ) : null}

      <PremiumUpgradeSheet
        visible={premiumSheetVisible}
        onClose={() => setPremiumSheetVisible(false)}
        onStartPremium={handleStartPremium}
      />
    </GestureHandlerRootView>
  );
}
