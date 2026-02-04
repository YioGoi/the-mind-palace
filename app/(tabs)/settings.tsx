import LogViewer from '@/components/log-viewer'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import React, { useState } from 'react'
import { Button, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function SettingsScreen() {
  const [showLogs, setShowLogs] = useState(false)

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Settings</ThemedText>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Local data</ThemedText>
          <ThemedText>
            {'🔒 '}All notes are stored locally on your device and are not uploaded anywhere. If you
            uninstall the app, this data will be removed from the device and cannot be recovered
            unless you have previously exported or backed up your device.
          </ThemedText>
        </ThemedView>

        {__DEV__ ? (
          <View style={{ marginTop: 8 }}>
            <Button title="View logs (dev)" onPress={() => setShowLogs(true)} />
          </View>
        ) : null}

        <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} />
      </ThemedView>
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
})
