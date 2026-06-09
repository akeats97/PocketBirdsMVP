import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { font, palette, radius } from '../../constants/Colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabPill({ name, color, focused }: { name: IoniconName; color: string; focused: boolean }) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.chip,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? palette.leafSoft : 'transparent',
      }}
    >
      <Ionicons name={name} size={20} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // The full safe-area inset (~34pt on a home-indicator iPhone) reads as an
  // oversized chin, so we encroach into it while keeping clearance for the
  // home indicator. Floor of 8 covers devices with no inset.
  const bottomPad = Math.max(insets.bottom - 12, 8);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.leaf,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopWidth: 2,
          borderTopColor: palette.ink,
          height: 50 + bottomPad,
          paddingTop: 0,
          paddingBottom: bottomPad,
        },
        tabBarLabelStyle: {
          fontFamily: font.body,
          fontSize: 10.5,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        // Custom JS header (wordmark + bell + avatar) shared by every tab. We
        // render it ourselves rather than using the native-stack header to dodge
        // iOS 26's glass bar-button styling — see components/AppHeader.tsx.
        headerShown: true,
        header: () => <AppHeader />,
      }}
      initialRouteName="add"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Log',
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color }) => (
            <TabPill name={focused ? 'list' : 'list-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add Sighting',
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color }) => (
            <TabPill name={focused ? 'add-circle' : 'add-circle-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="dex"
        options={{
          title: 'Dex',
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color }) => (
            <TabPill name={focused ? 'book' : 'book-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color }) => (
            <TabPill name={focused ? 'people' : 'people-outline'} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
