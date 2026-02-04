import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette } from '@/constants/palette';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
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
        return Palette.colorAccent;
      case tabNames.urgent:
        return Palette.colorDanger;
      case tabNames.have:
        return Palette.colorSuccess;
      case tabNames.nice:
        return Palette.colorAccent;
      case tabNames.settings:
        return Colors[colorScheme ?? 'light'].tint;
      default:
        return Colors[colorScheme ?? 'light'].tint;
    }
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: getTabNameIconActiveColor(route.name),
        headerShown: false,
        tabBarButton: HapticTab,
      })}
    >
      <Tabs.Screen
        name={tabNames.home}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name={tabNames.urgent}
        options={{
          title: 'Urgent',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="exclamationmark.triangle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name={tabNames.have}
        options={{
          title: 'Have',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checkmark.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name={tabNames.nice}
        options={{
          title: 'Nice',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name={tabNames.settings}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
