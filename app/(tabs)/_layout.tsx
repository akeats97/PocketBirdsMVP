import Ionicons from '@expo/vector-icons/Ionicons';
import { PlatformPressable } from '@react-navigation/elements';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
        // Kill the Android press ripple (the grey circle behind tab icons);
        // iOS keeps its default opacity dim. The focused TabPill background is
        // the press feedback.
        tabBarButton: (props) => (
          <PlatformPressable {...props} pressColor="transparent" />
        ),
        // Custom JS header (wordmark + bell + avatar) shared by every tab. We
        // render it ourselves rather than using the native-stack header to dodge
        // iOS 26's glass bar-button styling — see components/AppHeader.tsx.
        headerShown: true,
        header: () => <AppHeader />,
      }}
      initialRouteName="index"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Journal',
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color }) => (
            <TabPill name={focused ? 'list' : 'list-outline'} color={color} focused={focused} />
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
        name="add"
        options={{
          title: 'Add Sighting',
          // Center "Log" button — the app's most important action gets the
          // celebratory gold circle, raised Strava-style above the bar.
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.logButton}>
              <Ionicons name="add" size={30} color={palette.ink} />
            </View>
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
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          // The shared header grows edit + logout icons on this tab only, so
          // the profile content doesn't need its own action row.
          header: () => <AppHeader youActions />,
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color }) => (
            <TabPill name={focused ? 'person' : 'person-outline'} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // The raised gold Log circle. The tab bar doesn't clip overflow, so the
  // negative top margin lets it poke above the bar.
  logButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.sun,
    borderWidth: 2,
    borderColor: palette.ink,
    boxShadow: `2px 2px 0 ${palette.ink}`,
  },
});
