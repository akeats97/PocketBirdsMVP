import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from '@react-native-firebase/auth';
import { useActivity } from '../app/context/ActivityContext';
import { useSightings } from '../app/context/SightingsContext';
import { auth } from '../config/firebaseConfig';
import { font, palette, radius, space, type } from '../constants/Colors';
import { GUIDELINES_URL } from '../constants/links';
import { CURRENT_RELEASE_NAME } from '../constants/release';
import { BottomSheet } from './BottomSheet';
import { DeleteAccountSheet } from './DeleteAccountSheet';
import { openEditProfile } from './profile/EditProfileSheet';
import { openVisibilitySheet } from './profile/VisibilitySheet';

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
// One row of the ⋯ menu sheet.
function MenuRow({ icon, label, sub, danger, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={danger ? palette.crimson : palette.ink} style={styles.menuIcon} />
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuLabel, danger && { color: palette.crimson }]}>{label}</Text>
        {sub && <Text style={styles.menuSub}>{sub}</Text>}
      </View>
    </Pressable>
  );
}

// `youActions` (set by the You tab's header override) adds a ⋯ overflow menu
// next to the bell — edit profile / Hep / logout — so the profile page itself
// doesn't need a nav row pushing its content down.
export function AppHeader({ youActions }: { youActions?: boolean }) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useActivity();
  const { clearLocalData } = useSightings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Mirrors the old profile logout pill: clear local cache, then sign out —
  // the root auth listener swaps the UI to the login screen.
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearLocalData();
            await signOut(auth);
          } catch (error) {
            console.error('Error signing out:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.xs }]}>
      <Text style={styles.title} numberOfLines={1}>
        PocketBirds {CURRENT_RELEASE_NAME}
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
        {youActions && (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            style={styles.bell}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={palette.ink} />
          </TouchableOpacity>
        )}
      </View>

      {youActions && (
        <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <MenuRow
              icon="pencil-outline"
              label="Edit profile"
              onPress={() => {
                setMenuOpen(false);
                // The sheet is hosted by the You tab's ProfileView below. Stagger
                // past this menu's exit AND unmount (~260ms): iOS silently drops a
                // modal presented while another is still dismissing, which is why
                // Edit "did nothing" on iOS at the old 280ms.
                setTimeout(openEditProfile, 400);
              }}
            />
            <MenuRow
              icon="eye-outline"
              label="Account visibility"
              sub="Public or private flock"
              onPress={() => {
                setMenuOpen(false);
                // Same stagger as Edit profile: the sheet is hosted by the You
                // tab's ProfileView, and iOS drops a modal presented while
                // another is still dismissing.
                setTimeout(openVisibilitySheet, 400);
              }}
            />
            <MenuRow
              icon="chatbox-ellipses-outline"
              label="Hep"
              sub="Bug reports and feature requests"
              onPress={() => {
                setMenuOpen(false);
                router.push('/hep');
              }}
            />
            <MenuRow
              icon="shield-checkmark-outline"
              label="Community guidelines"
              onPress={() => {
                setMenuOpen(false);
                Linking.openURL(GUIDELINES_URL);
              }}
            />
            <MenuRow
              icon="log-out-outline"
              label="Log out"
              danger
              onPress={() => {
                setMenuOpen(false);
                handleLogout();
              }}
            />
            <MenuRow
              icon="trash-outline"
              label="Delete account"
              sub="Permanently removes you and your sightings"
              danger
              onPress={() => {
                setMenuOpen(false);
                // Let the menu's exit animation finish before the next sheet
                // slides up (same stagger as the badge guide).
                setTimeout(() => setDeleteOpen(true), 280);
              }}
            />
          </View>
        </BottomSheet>
      )}

      {youActions && (
        <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
      )}
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

  // ⋯ menu sheet (You tab)
  menuSheet: {
    backgroundColor: palette.cream,
    borderTopWidth: 2,
    borderColor: palette.ink,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.input,
  },
  menuRowPressed: {
    backgroundColor: palette.card,
  },
  menuIcon: {
    width: 24,
    textAlign: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuLabel: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '700',
  },
  menuSub: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 1,
  },
});
