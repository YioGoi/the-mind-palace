import { Image } from 'expo-image';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import { Palette } from '@/constants/palette';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();

  async function handleResetDb() {
    try {
      // Use documentDirectory if available, otherwise fallback to cacheDirectory
      const dbDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
      const dbPath = `${dbDir}SQLite/mindpalace.db`;
      await (FileSystem as any).deleteAsync(dbPath, { idempotent: true });
      Alert.alert('Database deleted', 'Restarting app...', [
        {
          text: 'OK',
          onPress: () => router.replace('/'),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to delete DB: ' + (e && e.message ? e.message : String(e)));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
        headerImage={
          <Image
            source={require('@/assets/images/hero-banner.png')}
            style={styles.reactLogo}
          />
        }>
        <ThemedView style={styles.greetingContainer}>
          <ThemedText type="subtitle">Welcome to</ThemedText>
          <ThemedText type="title">Mind Palace</ThemedText>
          <HelloWave />
          <ThemedText>
            A simple, iOS-first personal organizer. Notes live in three categories: Urgent, Have, and Nice. Create a note and let AI suggest a context for it.
          </ThemedText>

          <ThemedView style={styles.ctaRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.ctaBtn, { backgroundColor: Palette.colorDanger }]}
              onPress={() => router.push('/urgent')}
            >
              <ThemedText type="defaultSemiBold" style={styles.ctaBtnText}>Urgent</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.ctaBtn, { backgroundColor: Palette.colorSuccess }]}
              onPress={() => router.push('/have')}
            >
              <ThemedText type="defaultSemiBold" style={styles.ctaBtnText}>Have</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.ctaBtn, { backgroundColor: Palette.colorAccent }]}
              onPress={() => router.push('/nice')}
            >
              <ThemedText type="defaultSemiBold" style={styles.ctaBtnText}>Nice</ThemedText>
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
  ctaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  ctaBtn: {
    borderRadius: 18,
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
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  reactLogo: {
    height: 250,
    width: '100%',
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
