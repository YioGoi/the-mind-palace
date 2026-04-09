import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import AmbientBackgroundLayer from '@/components/ambient-background-layer';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useThemeStore } from '@/lib/store/theme-store';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { colors } = useAppTheme()
  const reducedMotionEnabled = useReducedMotion()
  const backgroundAnimationEnabled = useThemeStore((state) => state.backgroundAnimationEnabled)
  const tabNames = {
    home: 'index',
    urgent: 'urgent',
    have: 'have',
    nice: 'nice',
    settings: 'settings',
  }

  const getTabNameIconActiveColor = (tabName: string) => {
    switch (tabName) {
      case tabNames.home:
        return colors.colorAccent;
      case tabNames.urgent:
        return colors.colorDanger;
      case tabNames.have:
        return colors.colorSuccess;
      case tabNames.nice:
        return colors.colorAccent;
      case tabNames.settings:
        return Colors[colorScheme ?? 'light'].tint;
      default:
        return Colors[colorScheme ?? 'light'].tint;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.colorBgMain }]}>
      <AmbientBackgroundLayer
        enabled={backgroundAnimationEnabled}
        reducedMotion={reducedMotionEnabled}
        scheme={colorScheme ?? 'light'}
      />
      <Tabs
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: getTabNameIconActiveColor(route.name),
          headerShown: false,
          tabBarShowLabel: false,
          sceneStyle: {
            backgroundColor: 'transparent',
          },
          tabBarButton: HapticTab,
          tabBarIconStyle: {
            marginTop: 0,
            marginBottom: 0,
          },
          tabBarItemStyle: {
            paddingTop: 0,
            paddingBottom: 0,
            height: 44,
          },
          tabBarStyle: {
            backgroundColor: colors.colorBgMain,
            borderTopColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            height: 64,
            paddingTop: 0,
            paddingBottom: 6,
          },
        })}
      >
        <Tabs.Screen
          name={tabNames.home}
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={32} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name={tabNames.urgent}
          options={{
            title: 'Urgent',
            tabBarIcon: ({ color }) => <IconSymbol size={32} name="figure.walk.motion" color={color} />,
          }}
        />
        <Tabs.Screen
          name={tabNames.have}
          options={{
            title: 'Have',
            tabBarIcon: ({ color }) => <IconSymbol size={32} name="list.bullet" color={color} />,
          }}
        />
        <Tabs.Screen
          name={tabNames.nice}
          options={{
            title: 'Nice',
            tabBarIcon: ({ color }) => <IconSymbol size={32} name="lightbulb.max" color={color} />,
          }}
        />
        <Tabs.Screen
          name={tabNames.settings}
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <IconSymbol size={32} name="slider.horizontal.3" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
