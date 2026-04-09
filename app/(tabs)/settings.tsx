import LogViewer from '@/components/log-viewer'
import { PremiumUpgradeSheet } from '@/components/premium-upgrade-sheet'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useAppTheme } from '@/hooks/use-app-theme'
import { prepareCleanupQaDataset } from '@/lib/services/cleanup-qa-seed'
import { getOrCreateInstallId } from '@/lib/services/install-id'
import { PremiumCleanupNudge } from '@/lib/services/premium-cleanup-nudge'
import { useAiUpsellStore } from '@/lib/store/ai-upsell-store'
import { useNoteUiHintsStore } from '@/lib/store/note-ui-hints-store'
import { ThemePreference, useThemeStore } from '@/lib/store/theme-store'
import { AiRemoteUsage, fetchAiRemoteUsage, formatUsageProgress } from '@/lib/utils/ai-usage'
import { getSubscriptionCta } from '@/lib/utils/settings-subscription'
import React, { useState } from 'react'
import { ActivityIndicator, Button, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getAiCapabilities, getAiEntitlement, getAiGatewayUrl, getAiPlan, getPrimaryModel, hasAiUpsellMarketingEnabled } from '../../services/ai/config'
import { ModelCallResult, runDiagnostics } from '../../services/model-router'

export default function SettingsScreen() {
  const { colors } = useAppTheme()
  const themePreference = useThemeStore(state => state.preference)
  const setThemePreference = useThemeStore(state => state.setPreference)
  const backgroundAnimationEnabled = useThemeStore(state => state.backgroundAnimationEnabled)
  const setBackgroundAnimationEnabled = useThemeStore(state => state.setBackgroundAnimationEnabled)
  const devAiPlanOverride = useThemeStore(state => state.devAiPlanOverride)
  const setDevAiPlanOverride = useThemeStore(state => state.setDevAiPlanOverride)
  const resetUpsellForDev = useAiUpsellStore(state => state.resetForDev)
  const resetDoneActionHintForDev = useNoteUiHintsStore(state => state.resetDoneActionHintForDev)
  const entitlement = getAiEntitlement()
  const subscriptionCta = getSubscriptionCta(entitlement.hasPremiumAccess)
  const aiCapabilities = getAiCapabilities()
  const aiUpsellMarketingEnabled = hasAiUpsellMarketingEnabled()
  const [showLogs, setShowLogs] = useState(false)
  const [diagRunning, setDiagRunning] = useState(false)
  const [diagResults, setDiagResults] = useState<ModelCallResult[] | null>(null)
  const [premiumSheetVisible, setPremiumSheetVisible] = useState(false)
  const [installId, setInstallId] = useState<string | null>(null)
  const [remoteUsage, setRemoteUsage] = useState<AiRemoteUsage | null>(null)
  const [remoteUsageLoading, setRemoteUsageLoading] = useState(false)
  const [remoteUsageError, setRemoteUsageError] = useState<string | null>(null)
  const gatewayUrl = getAiGatewayUrl()

  React.useEffect(() => {
    let active = true

    getOrCreateInstallId()
      .then((value) => {
        if (active) {
          setInstallId(value)
        }
      })
      .catch(() => {
        if (active) {
          setInstallId(null)
        }
      })

    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    let active = true

    async function loadRemoteUsage() {
      if (!gatewayUrl || !installId) return
      setRemoteUsageLoading(true)
      setRemoteUsageError(null)
      try {
        const usage = await fetchAiRemoteUsage(gatewayUrl, installId)
        if (active) {
          setRemoteUsage(usage)
        }
      } catch (error) {
        if (active) {
          setRemoteUsage(null)
          setRemoteUsageError(error instanceof Error ? error.message : 'Failed to load AI usage.')
        }
      } finally {
        if (active) {
          setRemoteUsageLoading(false)
        }
      }
    }

    loadRemoteUsage()

    return () => {
      active = false
    }
  }, [gatewayUrl, installId])
  async function handleRunDiagnostics() {
    const endpoint = gatewayUrl
    if (!endpoint) {
      setDiagResults(null)
      return
    }
    setDiagRunning(true)
    setDiagResults(null)
    try {
      const results = await runDiagnostics(endpoint)
      setDiagResults(results)
    } finally {
      setDiagRunning(false)
    }
  }

  async function handleRefreshRemoteUsage() {
    if (!gatewayUrl || !installId) return
    setRemoteUsageLoading(true)
    setRemoteUsageError(null)
    try {
      const usage = await fetchAiRemoteUsage(gatewayUrl, installId)
      setRemoteUsage(usage)
    } catch (error) {
      setRemoteUsage(null)
      setRemoteUsageError(error instanceof Error ? error.message : 'Failed to load AI usage.')
    } finally {
      setRemoteUsageLoading(false)
    }
  }

  function ThemeOption({ value, label }: { value: ThemePreference; label: string }) {
    const active = themePreference === value
    return (
      <TouchableOpacity
        style={[
          styles.themeOption,
          {
            backgroundColor: active ? colors.colorPrimary : colors.colorBgMuted,
            borderColor: active ? colors.colorPrimary : colors.colorBorder,
          },
        ]}
        onPress={() => setThemePreference(value)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.themeOptionText,
            { color: active ? (colors.colorBgMain === '#000000' ? '#000' : '#fff') : colors.colorTextMain },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="title">Settings</ThemedText>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Appearance</ThemedText>
          <ThemedText>Choose how Mind Palace looks on this device.</ThemedText>
          <View style={styles.themeRow}>
            <ThemeOption value="system" label="System" />
            <ThemeOption value="light" label="Light" />
            <ThemeOption value="dark" label="Dark" />
          </View>
          <View style={[styles.settingRow, { borderTopColor: colors.colorBorder }]}>
            <View style={styles.settingCopy}>
              <ThemedText type="defaultSemiBold">Background animation</ThemedText>
              <ThemedText>Show the ambient mind-network motion behind your main screens.</ThemedText>
            </View>
            <Switch
              value={backgroundAnimationEnabled}
              onValueChange={setBackgroundAnimationEnabled}
              trackColor={{ false: colors.colorBorder, true: colors.colorPrimary }}
              thumbColor={backgroundAnimationEnabled ? colors.colorBgMain : colors.colorBgElevated}
              ios_backgroundColor={colors.colorBorder}
            />
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Subscription</ThemedText>
          <View style={[styles.settingRow, { borderTopColor: 'transparent', marginTop: 8, paddingTop: 0 }]}>
            <View style={styles.settingCopy}>
              <ThemedText type="defaultSemiBold">
                {subscriptionCta.title}
              </ThemedText>
              <ThemedText>
                {subscriptionCta.description}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.subscriptionButton, { backgroundColor: colors.colorPrimary }]}
              onPress={() => setPremiumSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.subscriptionButtonText, { color: colors.colorBgMain }]}>
                {subscriptionCta.actionLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">AI setup</ThemedText>
          <ThemedText>Plan: {getAiPlan()}</ThemedText>
          <ThemedText>Premium access: {entitlement.hasPremiumAccess ? 'enabled' : 'disabled'}</ThemedText>
          {!__DEV__ ? (
            <View style={[styles.settingRow, { borderTopColor: colors.colorBorder }]}>
              <View style={styles.settingCopy}>
                <ThemedText type="defaultSemiBold">Premium AI</ThemedText>
                <ThemedText>
                  Natural-language capture, context suggestion, and faster planning for $2.99 / month.
                </ThemedText>
              </View>
            </View>
          ) : null}
          {__DEV__ ? (
            <View style={[styles.settingRow, { borderTopColor: colors.colorBorder }]}>
              <View style={styles.settingCopy}>
                <ThemedText type="defaultSemiBold">DEV plan override</ThemedText>
                <ThemedText>Use this only in development to switch between free and premium behavior.</ThemedText>
              </View>
              <View style={styles.devPlanRow}>
                <TouchableOpacity
                  style={[
                    styles.devPlanOption,
                    {
                      backgroundColor: devAiPlanOverride === null ? colors.colorPrimary : colors.colorBgMuted,
                      borderColor: devAiPlanOverride === null ? colors.colorPrimary : colors.colorBorder,
                    },
                  ]}
                  onPress={() => setDevAiPlanOverride(null)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.devPlanText, { color: devAiPlanOverride === null ? colors.colorPrimarySoft : colors.colorTextMain }]}>
                    Env
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.devPlanOption,
                    {
                      backgroundColor: devAiPlanOverride === 'free' ? colors.colorPrimary : colors.colorBgMuted,
                      borderColor: devAiPlanOverride === 'free' ? colors.colorPrimary : colors.colorBorder,
                    },
                  ]}
                  onPress={() => setDevAiPlanOverride('free')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.devPlanText, { color: devAiPlanOverride === 'free' ? colors.colorPrimarySoft : colors.colorTextMain }]}>
                    Free
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.devPlanOption,
                    {
                      backgroundColor: devAiPlanOverride === 'premium' ? colors.colorPrimary : colors.colorBgMuted,
                      borderColor: devAiPlanOverride === 'premium' ? colors.colorPrimary : colors.colorBorder,
                    },
                  ]}
                  onPress={() => setDevAiPlanOverride('premium')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.devPlanText, { color: devAiPlanOverride === 'premium' ? colors.colorPrimarySoft : colors.colorTextMain }]}>
                    Premium
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ThemedView>

        {__DEV__ ? (
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">Developer Tools</ThemedText>
            <ThemedText>Internal AI and monetization diagnostics for development builds.</ThemedText>
            <View style={[styles.settingRow, { borderTopColor: colors.colorBorder }]}>
              <View style={styles.settingCopy}>
                <ThemedText type="defaultSemiBold">AI internals</ThemedText>
                <ThemedText>Access channel: {entitlement.channel}</ThemedText>
                <ThemedText>Upsell marketing: {aiUpsellMarketingEnabled ? 'enabled' : 'disabled'}</ThemedText>
                <ThemedText>Assistant planner: {aiCapabilities.canUseAssistantPlanner ? 'enabled' : 'fallback note capture'}</ThemedText>
                <ThemedText>Model: {getPrimaryModel()}</ThemedText>
                <ThemedText>Gateway: {gatewayUrl ?? 'Not configured'}</ThemedText>
                <ThemedText selectable>AI install ID: {installId ?? 'Loading...'}</ThemedText>
              </View>
            </View>
            <View style={[styles.settingRow, { borderTopColor: colors.colorBorder }]}>
              <View style={styles.settingCopy}>
                <ThemedText type="defaultSemiBold">Remote AI usage</ThemedText>
                {remoteUsage ? (
                  <>
                    <ThemedText>Remote plan: {remoteUsage.plan}</ThemedText>
                    <ThemedText>Quota profile: {remoteUsage.quotaProfile}</ThemedText>
                    <ThemedText>Billing period: {remoteUsage.period}</ThemedText>
                    <ThemedText>
                      Requests: {formatUsageProgress(remoteUsage.usage.requestCount, remoteUsage.limits?.monthlyRequestCount)}
                    </ThemedText>
                    <ThemedText>
                      Input tokens: {formatUsageProgress(remoteUsage.usage.inputTokens, remoteUsage.limits?.monthlyInputTokens)}
                    </ThemedText>
                    <ThemedText>
                      Output tokens: {formatUsageProgress(remoteUsage.usage.outputTokens, remoteUsage.limits?.monthlyOutputTokens)}
                    </ThemedText>
                    <ThemedText>Total tokens: {remoteUsage.usage.totalTokens}</ThemedText>
                    <ThemedText>Requests/min: {remoteUsage.limits?.requestsPerMinute ?? 'n/a'}</ThemedText>
                  </>
                ) : remoteUsageLoading ? (
                  <ThemedText>Loading remote usage…</ThemedText>
                ) : (
                  <ThemedText>{remoteUsageError ?? 'Remote usage not loaded yet.'}</ThemedText>
                )}
              </View>
              <TouchableOpacity
                style={[styles.subscriptionButton, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder, borderWidth: 1 }]}
                onPress={handleRefreshRemoteUsage}
                disabled={remoteUsageLoading || !gatewayUrl || !installId}
                activeOpacity={0.85}
              >
                {remoteUsageLoading
                  ? <ActivityIndicator size="small" color={colors.colorTextMain} />
                  : <Text style={[styles.subscriptionButtonText, { color: colors.colorTextMain }]}>Refresh usage</Text>}
              </TouchableOpacity>
            </View>
          </ThemedView>
        ) : null}

        {__DEV__ ? (
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">QA resets</ThemedText>
            <ThemedText>Re-run tooltip and upsell onboarding without clearing all local notes.</ThemedText>
            <View style={styles.debugButtonStack}>
              <TouchableOpacity
                style={[styles.debugResetButton, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder }]}
                onPress={() => void resetDoneActionHintForDev()}
                activeOpacity={0.8}
              >
                <Text style={[styles.debugResetButtonText, { color: colors.colorTextMain }]}>Reset done tooltip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugResetButton, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder }]}
                onPress={() => void resetUpsellForDev()}
                activeOpacity={0.8}
              >
                <Text style={[styles.debugResetButtonText, { color: colors.colorTextMain }]}>Reset AI upsell milestones</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugResetButton, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder }]}
                onPress={() => void PremiumCleanupNudge.resetForDev()}
                activeOpacity={0.8}
              >
                <Text style={[styles.debugResetButtonText, { color: colors.colorTextMain }]}>Clear cleanup nudge test state</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugResetButton, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder }]}
                onPress={() => void PremiumCleanupNudge.scheduleSoonForDev()}
                activeOpacity={0.8}
              >
                <Text style={[styles.debugResetButtonText, { color: colors.colorTextMain }]}>Schedule cleanup nudge in 30 sec</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugResetButton, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder }]}
                onPress={() => void PremiumCleanupNudge.scheduleAfterDelayForDev(5000)}
                activeOpacity={0.8}
              >
                <Text style={[styles.debugResetButtonText, { color: colors.colorTextMain }]}>Schedule cleanup nudge in 5 sec</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugResetButton, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder }]}
                onPress={() => void prepareCleanupQaDataset()}
                activeOpacity={0.8}
              >
                <Text style={[styles.debugResetButtonText, { color: colors.colorTextMain }]}>Prepare cleanup QA dataset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugResetButton, { backgroundColor: colors.colorBgMuted, borderColor: colors.colorBorder }]}
                onPress={() => setPremiumSheetVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.debugResetButtonText, { color: colors.colorTextMain }]}>Open premium sheet</Text>
              </TouchableOpacity>
            </View>
          </ThemedView>
        ) : null}

        {__DEV__ ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Button title="View logs (dev)" onPress={() => setShowLogs(true)} />

            <TouchableOpacity
              style={[styles.diagButton, { backgroundColor: colors.colorPrimary }, diagRunning && { opacity: 0.6 }]}
              onPress={handleRunDiagnostics}
              disabled={diagRunning}
              activeOpacity={0.8}
            >
              {diagRunning
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.diagButtonText}>Run AI model diagnostics</Text>
              }
            </TouchableOpacity>

            {diagResults && (
              <View style={[styles.diagResults, { borderColor: colors.colorBorder, backgroundColor: colors.colorBgElevated }]}>
                <Text style={[styles.diagTitle, { color: colors.colorTextSecondary }]}>Diagnostic results</Text>
                {diagResults.map(r => {
                  const ok = r.success
                  const f = r as any
                  return (
                    <View key={r.model} style={[styles.diagRow, { backgroundColor: colors.colorBgMuted }]}>
                      <Text style={[styles.diagLabel, { color: colors.colorTextMain }]}>
                        {ok ? '✓' : '✗'} {r.label}
                      </Text>
                      {ok ? (
                        <Text style={[styles.diagMeta, { color: colors.colorTextSecondary }]}>{r.latencyMs}ms</Text>
                      ) : (
                        <View>
                          <Text style={[styles.diagMeta, { color: colors.colorTextSecondary }]}>
                            {f.errorType?.toUpperCase()}
                            {f.provider ? ` · ${f.provider}` : ''}
                          </Text>
                          <Text style={[styles.diagMeta, { color: colors.colorTextSecondary }]}>
                            retryable: {String(f.retryable)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        ) : null}

        {__DEV__ && (
          <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} />
        )}
      </ScrollView>
      <PremiumUpgradeSheet
        visible={premiumSheetVisible}
        onClose={() => setPremiumSheetVisible(false)}
        onStartPremium={() => setPremiumSheetVisible(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    padding: 16,
    gap: 12,
  },
  section: {
    padding: 12,
    borderRadius: 8,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  settingRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  settingCopy: {
    flex: 1,
    gap: 4,
  },
  subscriptionButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  themeOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOptionText: {
    fontWeight: '700',
    fontSize: 14,
  },
  diagButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  diagButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  diagResults: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  diagTitle: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 8,
    borderRadius: 6,
  },
  diagLabel: { fontWeight: '600', fontSize: 13 },
  diagMeta: { fontSize: 12 },
  devPlanRow: {
    flexDirection: 'row',
    gap: 8,
  },
  devPlanOption: {
    minWidth: 86,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devPlanText: {
    fontWeight: '700',
    fontSize: 13,
  },
  debugButtonStack: {
    marginTop: 14,
    gap: 10,
  },
  debugResetButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  debugResetButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
})
