import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { PremiumUpgradeSheet } from '@/components/premium-upgrade-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import { useAppTheme } from '@/hooks/use-app-theme';
import { resetAppDatabase } from '@/lib/db/database';
import { useAiUpsellStore } from '@/lib/store/ai-upsell-store';
import { useNotesStore } from '@/lib/store/notes-store';
import { useThemeStore } from '@/lib/store/theme-store';
import { getActiveAiUpsellTeaser } from '@/lib/utils/ai-upsell-teaser';
import { logger } from '@/lib/utils/logger';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAiCapabilities, getAiEntitlement } from '../../services/ai/config';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme()
  const [premiumSheetVisible, setPremiumSheetVisible] = useState(false)
  const themeHydrated = useThemeStore(state => state.hydrated)
  const devAiPlanOverride = useThemeStore(state => state.devAiPlanOverride)
  const allNotes = useNotesStore(state => state.notes)
  const notesHydrated = useNotesStore(state => state.hydrated)
  const hasSeenTeaserAt3 = useAiUpsellStore(state => state.hasSeenTeaserAt3)
  const hasSeenTeaserAt7 = useAiUpsellStore(state => state.hasSeenTeaserAt7)
  const upsellHydrated = useAiUpsellStore(state => state.hydrated)
  const markTeaserSeen = useAiUpsellStore(state => state.markTeaserSeen)
  const aiCapabilities = themeHydrated ? getAiCapabilities() : null
  const premiumEnabled = aiCapabilities?.premiumEnabled ?? false
  const aiEntitlement = themeHydrated ? getAiEntitlement() : null
  const aiUpsellMarketingEnabled = aiCapabilities?.marketingEnabled ?? false
  const notesCreatedCount = allNotes.length
  const readyForTeaser = themeHydrated && notesHydrated && upsellHydrated
  const activeTeaser = React.useMemo(() => (
    getActiveAiUpsellTeaser({
      readyForTeaser,
      aiUpsellMarketingEnabled,
      premiumEnabled,
      notesCreatedCount,
      hasSeenTeaserAt3,
      hasSeenTeaserAt7,
    })
  ), [readyForTeaser, aiUpsellMarketingEnabled, premiumEnabled, notesCreatedCount, hasSeenTeaserAt3, hasSeenTeaserAt7])

  async function handleResetDb() {
    try {
      await resetAppDatabase()
      Alert.alert('App data reset', 'All local data has been cleared. Opening seed screen...', [
        {
          text: 'OK',
          onPress: () => router.replace('/seed-contexts'),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to reset app data: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function handleSeePremiumDetails() {
    if (!activeTeaser) return
    void markTeaserSeen(activeTeaser.milestone)
    setPremiumSheetVisible(true)
  }

  React.useEffect(() => {
    logger.info('HOME_UPSELL_DEBUG', {
      premiumEnabled,
      aiEntitlement,
      devAiPlanOverride,
      aiUpsellMarketingEnabled,
      themeHydrated,
      notesHydrated,
      upsellHydrated,
      notesCreatedCount,
      hasSeenTeaserAt3,
      hasSeenTeaserAt7,
      activeTeaser: activeTeaser?.milestone ?? null,
    })
  }, [premiumEnabled, aiEntitlement, devAiPlanOverride, aiUpsellMarketingEnabled, themeHydrated, notesHydrated, upsellHydrated, notesCreatedCount, hasSeenTeaserAt3, hasSeenTeaserAt7, activeTeaser])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ParallaxScrollView
        transparentContent
        headerBackgroundColor={{ light: '#FFFFFF', dark: '#000000' }}
        headerImage={
          <Image
            source={require('@/assets/images/hero-banner.png')}
            style={styles.reactLogo}
            contentFit="contain"
          />
        }>
        <ThemedView
          style={styles.greetingContainer}
          lightColor="transparent"
          darkColor="transparent"
        >
          <ThemedText>
            A simple, iOS-first personal organizer. Notes live in three categories: Urgent, Have, and Nice.
            {premiumEnabled && ` Create a note and let AI suggest a context for it.`}
          </ThemedText>

          {activeTeaser ? (
            <ThemedView
              style={[
                styles.teaserCard,
                {
                  backgroundColor: colors.colorBgElevated,
                  borderColor: colors.colorBorder,
                },
              ]}
              lightColor="transparent"
              darkColor="transparent"
            >
              <ThemedView style={styles.teaserCopy} lightColor="transparent" darkColor="transparent">
                <ThemedText type="defaultSemiBold">{activeTeaser.title}</ThemedText>
                <ThemedText>{activeTeaser.body}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.teaserActions} lightColor="transparent" darkColor="transparent">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => void markTeaserSeen(activeTeaser.milestone)}
                  style={[styles.teaserDismiss, { borderColor: colors.colorBorder }]}
                >
                  <ThemedText type="defaultSemiBold">Got it</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSeePremiumDetails}
                  style={[styles.teaserPrimary, { backgroundColor: colors.colorPrimary }]}
                >
                  <ThemedText type="defaultSemiBold" style={{ color: colors.colorBgMain }}>
                    See details
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.ctaRow} lightColor="transparent" darkColor="transparent">
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.ctaBtn, { backgroundColor: colors.colorDanger }]}
              onPress={() => router.push('/urgent')}
            >
              <ThemedText type="defaultSemiBold" style={[styles.ctaBtnText, { color: "#fff" }]}>Urgent</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.ctaBtn, { backgroundColor: colors.colorSuccess }]}
              onPress={() => router.push('/have')}
            >
              <ThemedText type="defaultSemiBold" style={[styles.ctaBtnText, { color: "#fff" }]}>Have</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.ctaBtn, { backgroundColor: colors.colorAccent }]}
              onPress={() => router.push('/nice')}
            >
              <ThemedText type="defaultSemiBold" style={[styles.ctaBtnText, { color: colors.colorPrimarySoft }]}>Nice</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
        {__DEV__ && (
          <TouchableOpacity
            style={{ marginTop: 32, alignSelf: 'center', backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 }}
            onPress={handleResetDb}
            activeOpacity={0.85}
          >
            <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Reset DB (DEV)</ThemedText>
          </TouchableOpacity>
        )}
      </ParallaxScrollView>
      <PremiumUpgradeSheet
        visible={premiumSheetVisible}
        onClose={() => setPremiumSheetVisible(false)}
        onStartPremium={() => {
          setPremiumSheetVisible(false)
          router.push('/settings')
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  greetingContainer: {
    gap: 10,
    marginBottom: 12,
  },
  teaserCard: {
    marginTop: 6,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  teaserCopy: {
    gap: 4,
  },
  teaserDismiss: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  teaserActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teaserPrimary: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  ctaBtn: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  ctaBtnText: {
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  reactLogo: {
    width: '100%',
    height: '100%',
    left: 0,
    top: 0,
    position: 'absolute',
  },
});
