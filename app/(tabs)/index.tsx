import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import FriendSightingCard from '../../components/FriendSightingCard';
import { DayHeader } from '../../components/journal/DayHeader';
import LoadingSplash from '../../components/journal/LoadingSplash';
import SightingCard, { HardShadow } from '../../components/SightingCard';
import { border, font, palette, radius, recipes, space, type } from '../../constants/Colors';
import { isReportEntry } from '../../constants/reportTypes';
import { isUnknownEntry } from '../../constants/unknownBird';
import { useActivity } from '../context/ActivityContext';
import { useFriendSightings } from '../context/FriendSightingsContext';
import { useSightings } from '../context/SightingsContext';
import { FriendSighting, Sighting } from '../types';
import { groupSightingsByDay } from '../utils/groupSightingsByDay';
import { useCollapsedDays } from '../utils/useCollapsedDays';

// The merged feed mixes your sightings with your friends'. Tagged union so the
// renderer knows which card to draw; both sides extend Sighting, which is all
// groupSightingsByDay needs.
type FeedItem =
  | (Sighting & { kind: 'own' })
  | (FriendSighting & { kind: 'friend' });

function JournalHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Field Journal</Text>
    </View>
  );
}

// Friendless + birdless cold start — the feed's job is to feel alive, so the
// empty state points at both ways to fill it.
function EmptyState({ hasFriends, onFindFriends }: { hasFriends: boolean; onFindFriends: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <HardShadow>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {hasFriends ? 'Nothing logged yet.' : "It's quiet out here."}
          </Text>
          <Text style={styles.emptySubtitle}>
            {hasFriends
              ? 'Tap the + below when you see something.'
              : 'Log your first bird with the + below, and find your friends to bring this feed to life.'}
          </Text>
          {!hasFriends && (
            <HardShadow offset={3} borderRadius={radius.input} style={{ marginTop: space.md }}>
              <Pressable
                style={({ pressed }) => [styles.findFriendsButton, pressed && { backgroundColor: palette.ink }]}
                onPress={onFindFriends}
              >
                <Text style={styles.findFriendsButtonText}>Find Friends</Text>
              </Pressable>
            </HardShadow>
          )}
        </View>
      </HardShadow>
    </View>
  );
}

export default function JournalScreen() {
  const router = useRouter();
  const { sightings } = useSightings();
  const { friendSightings, friends, friendsReady, refreshFriends } = useFriendSightings();
  const { unreadBySighting } = useActivity();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bug Report / Feature Request entries are hidden from the feed on both
  // sides (they live in the Friends tab's Hep view).
  const feedItems = useMemo<FeedItem[]>(() => {
    const own: FeedItem[] = sightings
      .filter((s) => !isReportEntry(s.birdName))
      .map((s) => ({ ...s, kind: 'own' as const }));
    const theirs: FeedItem[] = friendSightings
      .filter((s) => !isReportEntry(s.birdName))
      .map((s) => ({ ...s, kind: 'friend' as const }));
    return [...own, ...theirs];
  }, [sightings, friendSightings]);

  const { collapsedDays, toggleDay } = useCollapsedDays();

  // Collapsed days keep their header (with counts) but render no rows.
  const sections = useMemo(
    () => groupSightingsByDay(feedItems).map(s =>
      collapsedDays.has(s.key) ? { ...s, data: [] } : s
    ),
    [feedItems, collapsedDays]
  );

  // Precompute the set of YOUR sighting ids that are the "1ST" (first-of-
  // species) record, once per sightings change, instead of calling
  // isNewSpeciesForUser (an O(n) filter+sort) for every card on every render.
  // Reproduces that helper exactly: the earliest sighting of a species by
  // timestamp, plus any other sighting on that same local day.
  const newSpeciesIds = useMemo(() => {
    const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const earliestTime: Record<string, number> = {};
    const earliestDay: Record<string, string> = {};
    for (const s of sightings) {
      const key = s.birdName.toLowerCase();
      const t = s.date.getTime();
      if (earliestTime[key] === undefined || t < earliestTime[key]) {
        earliestTime[key] = t;
        earliestDay[key] = dayKey(s.date);
      }
    }
    const ids = new Set<string>();
    for (const s of sightings) {
      if (dayKey(s.date) === earliestDay[s.birdName.toLowerCase()]) ids.add(s.id);
    }
    return ids;
  }, [sightings]);

  // Same precompute for friends' "1ST" badges: earliest sighting of a
  // (friend, species) by timestamp, plus any on that same calendar day.
  // Reports / Mystery excluded.
  const firstSightingIds = useMemo(() => {
    const earliestTime: Record<string, number> = {};
    const earliestDateStr: Record<string, string> = {};
    for (const s of friendSightings) {
      if (isReportEntry(s.birdName) || isUnknownEntry(s.birdName)) continue;
      const key = s.friendName + ' ' + s.birdName.toLowerCase();
      const t = s.date.getTime();
      if (earliestTime[key] === undefined || t < earliestTime[key]) {
        earliestTime[key] = t;
        earliestDateStr[key] = s.date.toDateString();
      }
    }
    const ids = new Set<string>();
    for (const s of friendSightings) {
      if (isReportEntry(s.birdName) || isUnknownEntry(s.birdName)) continue;
      const key = s.friendName + ' ' + s.birdName.toLowerCase();
      if (s.date.toDateString() === earliestDateStr[key]) ids.add(s.id);
    }
    return ids;
  }, [friendSightings]);

  // Stable renderItem: paired with React.memo on both cards, unchanged rows
  // skip re-render on each live snapshot.
  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) =>
      item.kind === 'own' ? (
        <SightingCard
          sighting={item}
          isNewSpecies={!isUnknownEntry(item.birdName) && newSpeciesIds.has(item.id)}
          unreadCount={unreadBySighting[item.id] ?? 0}
        />
      ) : (
        <FriendSightingCard sighting={item} isFirstSighting={firstSightingIds.has(item.id)} />
      ),
    [newSpeciesIds, unreadBySighting, firstSightingIds]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFriends();
    } catch (error) {
      console.error('Error refreshing friends:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Hold the loading splash on first open until the friend feed has settled, so
  // we don't flash your local-only sightings and then reflow when friends pop
  // in. When offline / friendless / errored, friendsReady flips fast and we fall
  // through to the feed (own sightings only). Never re-triggers on refresh.
  if (!friendsReady) {
    return (
      <View style={styles.container}>
        <JournalHeader />
        <LoadingSplash />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <DayHeader
            title={section.title}
            sightingCount={section.sightingCount}
            speciesCount={section.speciesCount}
            collapsed={collapsedDays.has(section.key)}
            onToggle={() => toggleDay(section.key)}
          />
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={JournalHeader}
        ListEmptyComponent={
          <EmptyState
            hasFriends={friends.length > 0}
            onFindFriends={() => router.push('/(tabs)/friends')}
          />
        }
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={
          feedItems.length === 0
            ? styles.emptyListContent
            : styles.listContent
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  title: {
    ...type.h1,
    color: palette.ink,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: space.xl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
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
  findFriendsButton: {
    backgroundColor: palette.leaf,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.input,
    ...border.thick,
    alignItems: 'center',
  },
  findFriendsButtonText: {
    fontFamily: font.display,
    fontWeight: '700',
    fontSize: 15,
    color: '#fff',
    letterSpacing: -0.3,
  },
});
