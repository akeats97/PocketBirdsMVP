import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FriendSightingCard from '../components/FriendSightingCard';
import { HardShadow } from '../components/SightingCard';
import { auth } from '../config/firebaseConfig';
import { palette, recipes, space, type } from '../constants/Colors';
import { isReportEntry } from '../constants/reportTypes';
import { useFriendSightings } from './context/FriendSightingsContext';
import { useSightings } from './context/SightingsContext';
import { FriendSighting } from './types';

// Hep — all Bug Report / Feature Request entries, yours and your friends'.
// Reached from the You tab's ⋯ menu. Your own reports are hidden from the
// Field Journal; this is the one place you can see what you submitted.
export default function HepScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { friendSightings } = useFriendSightings();
  const { sightings: ownSightings } = useSightings();

  // The user's own reports, shaped like a friend sighting so they render in
  // the same card.
  const ownReports = useMemo<FriendSighting[]>(
    () => ownSightings
      .filter(s => isReportEntry(s.birdName))
      .map(s => ({ ...s, friendName: 'You', friendId: auth.currentUser?.uid })),
    [ownSightings]
  );

  // Everyone's reports (friends' + own), newest first.
  const reportItems = useMemo<FriendSighting[]>(() => {
    const friendReports = friendSightings.filter(s => isReportEntry(s.birdName));
    return [...ownReports, ...friendReports].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [friendSightings, ownReports]);

  return (
    <View style={styles.screen}>
      <View style={[styles.navBar, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
        <Text style={styles.navTitle}>Hep</Text>
      </View>

      {reportItems.length === 0 ? (
        <View style={styles.emptyState}>
          <HardShadow>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No feedback yet.</Text>
              <Text style={styles.emptySubtitle}>
                Bug reports and feature requests (yours and your friends’) show up here.
              </Text>
            </View>
          </HardShadow>
        </View>
      ) : (
        <FlatList
          data={reportItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FriendSightingCard sighting={item} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: palette.ink,
  },
  backBtn: { padding: 2 },
  navTitle: { ...type.h3, color: palette.ink },

  listContent: {
    paddingVertical: space.sm,
    paddingBottom: space.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
  },
  emptyCard: {
    ...recipes.card,
    padding: space.xl,
    alignItems: 'center',
    minWidth: 260,
    maxWidth: 320,
  },
  emptyTitle: {
    ...type.h2,
    color: palette.ink,
    marginBottom: space.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
  },
});
