import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivity } from '../app/context/ActivityContext';
import { getCurrentUserProfile } from '../app/services/userService';
import { font, palette, space } from '../constants/Colors';
import { CURRENT_RELEASE_NAME } from '../constants/release';
import { Avatar } from './social/Avatar';

// App-wide top bar for the tab screens.
//
// We render this ourselves (the `(tabs)` route now uses headerShown:false)
// instead of leaning on the native-stack header. Two reasons, both seen on the
// first iOS 26 SDK build (TestFlight, Antwren):
//   1. Wrapping the navigator in a top-inset SafeAreaView double-insets the
//      native header, shoving the title down a full status-bar height.
//   2. iOS 26's "Liquid Glass" nav bar wraps custom `headerRight` views (our
//      bell + avatar) in a capsule that mis-sized and clipped the avatar off
//      the right edge of the screen.
// A plain View header owns its own top inset and lays out the title + controls
// with no native bar-button styling, sidestepping both.
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useActivity();
  const [me, setMe] = useState<{ uid: string; username: string } | null>(null);

  useEffect(() => {
    getCurrentUserProfile().then((p) => {
      if (p) setMe({ uid: p.uid, username: p.username });
    });
  }, []);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.xs }]}>
      <Text style={styles.title} numberOfLines={1}>
        Pocket Birds {CURRENT_RELEASE_NAME}
      </Text>
      <View style={styles.right}>
        <TouchableOpacity
          onPress={() => router.push('/activity')}
          style={styles.bell}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={unreadCount > 0 ? `Activity, ${unreadCount} unread` : 'Activity'}
        >
          <Ionicons name="notifications-outline" size={24} color={palette.ink} />
          {unreadCount > 0 && <View style={styles.unreadDot} />}
        </TouchableOpacity>
        {me && (
          <TouchableOpacity
            onPress={() => router.push(`/profile/${me.uid}`)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Your profile"
          >
            <Avatar name={me.username} seed={me.uid} size={32} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.cream,
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
    gap: space.md,
  },
  title: {
    flex: 1,
    fontFamily: font.display,
    fontSize: 20,
    color: palette.ink,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  bell: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.coral,
    borderWidth: 1,
    borderColor: palette.cream,
  },
});
