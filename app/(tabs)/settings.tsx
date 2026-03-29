import LogViewer from '@/components/log-viewer'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { Palette } from '@/constants/palette'
import { useAppTheme } from '@/hooks/use-app-theme'
import React, { useState } from 'react'
import { ActivityIndicator, Button, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ThemePreference, useThemeStore } from '../store/theme-store'
import { getAiGatewayUrl, getAiPlan, getPrimaryModel } from '../../services/ai/config'
import { ModelCallResult, runDiagnostics } from '../../services/model-router'

export default function SettingsScreen() {
  const { colors } = useAppTheme()
  const themePreference = useThemeStore(state => state.preference)
  const setThemePreference = useThemeStore(state => state.setPreference)
  const backgroundAnimationEnabled = useThemeStore(state => state.backgroundAnimationEnabled)
  const setBackgroundAnimationEnabled = useThemeStore(state => state.setBackgroundAnimationEnabled)
  const devAiPlanOverride = useThemeStore(state => state.devAiPlanOverride)
  const setDevAiPlanOverride = useThemeStore(state => state.setDevAiPlanOverride)
  const [showLogs, setShowLogs] = useState(false)
  const [diagRunning, setDiagRunning] = useState(false)
  const [diagResults, setDiagResults] = useState<ModelCallResult[] | null>(null)

  async function handleRunDiagnostics() {
    const endpoint = getAiGatewayUrl()
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
      <ScrollView contentContainerStyle={styles.container}>
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
          <ThemedText type="subtitle">AI setup</ThemedText>
          <ThemedText>Plan: {getAiPlan()}</ThemedText>
          <ThemedText>Model: {getPrimaryModel()}</ThemedText>
          <ThemedText>Gateway: {getAiGatewayUrl() ?? 'Not configured'}</ThemedText>
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
                      backgroundColor: (devAiPlanOverride ?? getAiPlan()) === 'free' ? colors.colorPrimary : colors.colorBgMuted,
                      borderColor: (devAiPlanOverride ?? getAiPlan()) === 'free' ? colors.colorPrimary : colors.colorBorder,
                    },
                  ]}
                  onPress={() => setDevAiPlanOverride('free')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.devPlanText, { color: (devAiPlanOverride ?? getAiPlan()) === 'free' ? '#fff' : colors.colorTextMain }]}>
                    Free
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.devPlanOption,
                    {
                      backgroundColor: (devAiPlanOverride ?? getAiPlan()) === 'premium' ? colors.colorPrimary : colors.colorBgMuted,
                      borderColor: (devAiPlanOverride ?? getAiPlan()) === 'premium' ? colors.colorPrimary : colors.colorBorder,
                    },
                  ]}
                  onPress={() => setDevAiPlanOverride('premium')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.devPlanText, { color: (devAiPlanOverride ?? getAiPlan()) === 'premium' ? '#fff' : colors.colorTextMain }]}>
                    Premium
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Local data</ThemedText>
          <ThemedText>
            {'🔒 '}All notes are stored locally on your device and are not uploaded anywhere. If you
            uninstall the app, this data will be removed from the device and cannot be recovered
            unless you have previously exported or backed up your device.
          </ThemedText>
        </ThemedView>

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

        <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} />
      </ScrollView>
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
    flexDirection: 'row',
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
    backgroundColor: Palette.colorPrimary,
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
    borderColor: Palette.colorBorder,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  diagTitle: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
    color: Palette.colorTextSecondary,
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
})
