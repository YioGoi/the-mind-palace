import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Button, StyleSheet, TextInput, View } from 'react-native';
import { useAppTheme } from '@/hooks/use-app-theme';
import { logger } from './utils/logger';
// Set a custom screen title for this route
export const unstable_settings = {
  title: 'Create Contexts',
};

export default function SeedContextsScreen() {
  const router = useRouter()
  const { colors } = useAppTheme()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [c, setC] = useState('')
  const [loading, setLoading] = useState(false)

  const allFilled = a.trim().length > 0 && b.trim().length > 0 && c.trim().length > 0

  const onContinue = async () => {
    if (!allFilled) return
    setLoading(true)
    try {
      const mod = await import('./db/contexts-repo')
      await mod.ContextsRepo.init()
      await mod.ContextsRepo.createContexts([a.trim(), b.trim(), c.trim()])
      logger.info('Seeded first contexts', { values: [a, b, c] })
      router.replace('/(tabs)')
    } catch (e) {
      logger.error('Failed seeding contexts', { err: e })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Create Contexts' }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title">Create your first 3 contexts</ThemedText>
        <ThemedText>
          These will act as your first "mental drawers". You can rename or move notes between
          contexts later.
        </ThemedText>

        <View style={styles.inputs}>
          <TextInput
            value={a}
            onChangeText={setA}
            placeholder="Context 1"
            placeholderTextColor={colors.colorTextMuted}
            style={[
              styles.input,
              {
                color: colors.colorTextMain,
                borderColor: colors.colorBorder,
                backgroundColor: colors.colorBgMuted,
              },
            ]}
          />
          <TextInput
            value={b}
            onChangeText={setB}
            placeholder="Context 2"
            placeholderTextColor={colors.colorTextMuted}
            style={[
              styles.input,
              {
                color: colors.colorTextMain,
                borderColor: colors.colorBorder,
                backgroundColor: colors.colorBgMuted,
              },
            ]}
          />
          <TextInput
            value={c}
            onChangeText={setC}
            placeholder="Context 3"
            placeholderTextColor={colors.colorTextMuted}
            style={[
              styles.input,
              {
                color: colors.colorTextMain,
                borderColor: colors.colorBorder,
                backgroundColor: colors.colorBgMuted,
              },
            ]}
          />
        </View>

        <Button title={loading ? 'Saving...' : 'Continue'} onPress={onContinue} disabled={!allFilled || loading} />
      </ThemedView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  banner: {
    width: '100%',
    height: 180,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputs: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
})
