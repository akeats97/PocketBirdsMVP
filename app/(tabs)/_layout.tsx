import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
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
  // iOS only: the full safe-area inset (~34pt on a home-indicator iPhone) reads
  // as an oversized chin, so we encroach into it while keeping clearance for the
  // home indicator. Android is left at its original values (the tighter inset
  // crowded the gesture bar there), so it keeps the full inset.
  // baseHeight is the icon/label content area; total bar = baseHeight + bottomPad.
  // Android restores the original (paddingBottom 8 + inset, total height 60 + inset
  // => content 52). iOS uses the tightened chin.
  const bottomPad = Platform.OS === 'ios' ? Math.max(insets.bottom - 12, 8) : 8 + insets.bottom;
  const baseHeight = Platform.OS === 'ios' ? 50 : 52;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.leaf,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopWidth: 2,
          borderTopColor: palette.ink,
          height: baseHeight + bottomPad,
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
