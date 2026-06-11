import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { BottomSheet } from '../../components/BottomSheet';
import { HardShadow } from '../../components/SightingCard';
import { Avatar } from '../../components/social/Avatar';
import { BellGlyph, bellColor } from '../../components/social/NotifBell';
import { auth } from '../../config/firebaseConfig';
import { border, font, palette, radius, recipes, space, type } from '../../constants/Colors';
import { isReportEntry } from '../../constants/reportTypes';
import { useFriendSightings } from '../context/FriendSightingsContext';
import { useSightings } from '../context/SightingsContext';
import { FriendSighting, Sighting } from '../types';
import { sightingCount, speciesSet } from '../utils/compareLists';
import { DEFAULT_MODE, NotificationMode, setPref, subscribeToPrefs } from '../services/notificationPrefsService';
import { getSightingsByUid } from '../services/sightingService';
import { getCurrentUserProfile, UserProfile, isFollowing, searchUsers, unfollowUser } from '../services/userService';

interface SearchResultUser extends UserProfile {
  isFollowing?: boolean;
  speciesCount?: number; // distinct species, filled in async after the row appears
}

type Period = 'all' | 'year';

// Same copy as NotifPrefSheet — the three per-friend notification levels.
const NOTIF_OPTIONS: { mode: NotificationMode; title: string; sub: string }[] = [
  { mode: 'all', title: 'All sightings', sub: 'Push every time.' },
  { mode: 'highlights', title: 'Highlights only', sub: 'New species and milestones.' },
  { mode: 'none', title: 'Nothing', sub: 'Silent, but still in your feed.' },
];

interface FriendRow {
  uid: string;
  name: string;       // display name ("You" for self)
  avatarName: string; // what the avatar initial comes from
  isSelf: boolean;
  species: number;
  sightings: number;
  photos: number;
}

// Species / sightings / photo counts for one birder within the period.
// Species + sightings reuse the journal's exclusion rules so numbers match
// the rest of the app.
function statsFor(list: Sighting[], year: number | null) {
  const inPeriod = year == null ? list : list.filter((s) => s.date.getFullYear() === year);
  return {
    species: speciesSet(inPeriod).size,
    sightings: sightingCount(inPeriod),
    photos: inPeriod.filter((s) => !isReportEntry(s.birdName) && !!s.photoUrl).length,
  };
}

export default function FriendsScreen() {
  const router = useRouter();
  const { friendSightings, friends, isLoadingFriends, refreshFriends } = useFriendSightings();
  const { sightings: ownSightings } = useSightings();
  const [searchQuery, setSearchQuery] = useState('');
  // Birder search results — includes public strangers, not just followed
  // friends, so the search box is a doorway to any profile.
  const [birderResults, setBirderResults] = useState<SearchResultUser[]>([]);
  const [isSearchingBirders, setIsSearchingBirders] = useState(false);
  const [period, setPeriod] = useState<Period>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [myName, setMyName] = useState('');
  // Long-pressed friend — drives the follow/notification action sheet.
  const [actionFor, setActionFor] = useState<FriendRow | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, NotificationMode>>({});
  const searchInputRef = useRef<TextInput>(null);

  // Resolve my own username for the "You" row's avatar initial (falls back to
  // the email initial like the rest of the app).
  useEffect(() => {
    let cancelled = false;
    getCurrentUserProfile().then((p) => {
      if (!cancelled && p) setMyName(p.username || p.email || '');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // The flock list: you + everyone you follow, with period-scoped stats.
  // Sorted by species (then sightings) so it doubles as the friendly
  // standings view — names and numbers, no rank styling.
  const rows = useMemo<FriendRow[]>(() => {
    const year = period === 'year' ? new Date().getFullYear() : null;
    const byFriend = new Map<string, FriendSighting[]>();
    for (const s of friendSightings) {
      if (!s.friendId) continue;
      const list = byFriend.get(s.friendId);
      if (list) list.push(s);
      else byFriend.set(s.friendId, [s]);
    }
    const list: FriendRow[] = friends.map((f) => ({
      uid: f.id,
      name: f.name,
      avatarName: f.name,
      isSelf: false,
      ...statsFor(byFriend.get(f.id) ?? [], year),
    }));
    const myUid = auth.currentUser?.uid;
    if (myUid) {
      list.push({
        uid: myUid,
        name: 'You',
        avatarName: myName,
        isSelf: true,
        ...statsFor(ownSightings, year),
      });
    }
    list.sort((a, b) =>
      b.species - a.species || b.sightings - a.sightings || a.name.localeCompare(b.name)
    );
    return list;
  }, [friends, friendSightings, ownSightings, period, myName]);

  // Search is active (replaces the page with a full-page birder list) the
  // moment there's any query text.
  const searching = searchQuery.trim().length > 0;

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

  // Debounced birder search (≥2 chars) so typing surfaces people to visit,
  // including public strangers. Each result is enriched with its follow state,
  // then (lazily, after the rows render) with the person's species count.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setBirderResults([]);
      setIsSearchingBirders(false);
      return;
    }
    let cancelled = false;
    setIsSearchingBirders(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(q);
        const withFollow = await Promise.all(
          results.map(async (u) => ({ ...u, isFollowing: await isFollowing(u.uid) }))
        );
        if (cancelled) return;
        setBirderResults(withFollow);
        setIsSearchingBirders(false);
        // Fill in species counts in the background — the rows show immediately
        // and the "{N} species" line populates as each fetch resolves.
        withFollow.forEach(async (u) => {
          try {
            const theirs = await getSightingsByUid(u.uid);
            const count = speciesSet(theirs).size;
            if (!cancelled) {
              setBirderResults(prev => prev.map(r => r.uid === u.uid ? { ...r, speciesCount: count } : r));
            }
          } catch {
            /* leave speciesCount undefined on failure */
          }
        });
      } catch (error) {
        console.error('Birder search failed:', error);
        if (!cancelled) { setBirderResults([]); setIsSearchingBirders(false); }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  // Navigate into a profile. Keep the query intact so back returns to results.
  const goToProfile = (uid: string) => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    router.push(`/profile/${uid}`);
  };

  // Keep a live map of the current user's per-friend notification modes.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return subscribeToPrefs(uid, setNotificationPrefs);
  }, []);

  const modeFor = (uid: string): NotificationMode => notificationPrefs[uid] ?? DEFAULT_MODE;

  const openActions = (row: FriendRow) => {
    if (row.isSelf) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActionFor(row);
  };

  const handleSelectMode = async (followedUid: string, mode: NotificationMode) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const previous = notificationPrefs[followedUid];
    // Optimistic: update the map and close the sheet, revert on failure.
    setNotificationPrefs(prev => ({ ...prev, [followedUid]: mode }));
    setActionFor(null);
    try {
      await setPref(uid, followedUid, mode);
    } catch (error) {
      console.error('Failed to save notification preference:', error);
      setNotificationPrefs(prev => ({ ...prev, [followedUid]: previous ?? DEFAULT_MODE }));
      Alert.alert('Error', "Couldn't save that preference. Please try again.");
    }
  };

  const handleUnfollow = (row: FriendRow) => {
    setActionFor(null);
    Alert.alert(`Unfollow ${row.name}?`, 'Their sightings will leave your feed. They won\'t be notified.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfollow',
        style: 'destructive',
        onPress: async () => {
          try {
            await unfollowUser(row.uid);
            await refreshFriends(); // row leaves the flock list
          } catch (error) {
            console.error('Unfollow failed:', error);
            Alert.alert('Error', `Couldn't unfollow ${row.name}. Please try again.`);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        {/* Title + search on one row — search is right-aligned and fills the
            space left of it. */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Friends</Text>
          <HardShadow offset={4} borderRadius={radius.input} style={styles.searchShadow}>
            <View style={styles.searchContainer}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search birders…"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                autoCorrect={false}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  style={styles.searchTrailing}
                >
                  <Ionicons name="close-circle" size={20} color={palette.inkSoft} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="search" size={18} color={palette.inkSoft} style={styles.searchTrailing} />
              )}
            </View>
          </HardShadow>
        </View>

      </View>

      {/* Search active → full-page birder results, replacing the page */}
      {searching ? (
        searchQuery.trim().length < 2 ? (
          <View style={styles.searchHintWrap}>
            <Text style={styles.searchHintText}>Keep typing to find birders…</Text>
          </View>
        ) : isSearchingBirders ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.leaf} />
            <Text style={styles.loadingText}>Searching birders...</Text>
          </View>
        ) : (
          <FlatList
            data={birderResults}
            keyExtractor={(item) => item.uid}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.searchResultsContent}
            ListHeaderComponent={
              birderResults.length > 0 ? (
                <Text style={styles.resultCount}>
                  {birderResults.length} {birderResults.length === 1 ? 'BIRDER' : 'BIRDERS'}
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable style={styles.birderRow} onPress={() => goToProfile(item.uid)}>
                <Avatar name={item.username} seed={item.uid} size={48} round />
                <View style={styles.birderInfo}>
                  <Text style={styles.birderName} numberOfLines={1}>{item.username}</Text>
                  <View style={styles.birderMetaRow}>
                    <Text style={styles.birderHandle} numberOfLines={1}>@{item.username.toLowerCase()}</Text>
                    {typeof item.speciesCount === 'number' && (
                      <>
                        <Text style={styles.birderDot}>·</Text>
                        <Text style={styles.birderSpecies}>{item.speciesCount} species</Text>
                      </>
                    )}
                    {!item.isFollowing && (
                      <Text style={styles.notFollowingTag}>NOT FOLLOWING</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.muted} />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.searchHintWrap}>
                <Text style={styles.searchHintText}>No birders found for “{searchQuery.trim()}”.</Text>
              </View>
            }
          />
        )
      ) : isLoadingFriends && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.leaf} />
          <Text style={styles.loadingText}>Loading your flock...</Text>
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.emptyState}>
          <HardShadow>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No flock yet.</Text>
              <Text style={styles.emptySubtitle}>
                Search for a friend's username above to start following them.
              </Text>
              <HardShadow offset={3} borderRadius={radius.input} style={{ marginTop: space.md }}>
                <Pressable
                  style={({ pressed }) => [styles.findFriendsButton, pressed && { backgroundColor: palette.ink }]}
                  onPress={() => searchInputRef.current?.focus()}
                >
                  <Text style={styles.findFriendsButtonText}>Find Friends</Text>
                </Pressable>
              </HardShadow>
            </View>
          </HardShadow>
        </View>
      ) : (
        <Animated.FlatList
          data={rows}
          keyExtractor={(item) => item.uid}
          // Toggling the period re-sorts the rows; each row springs to its new
          // spot (same spring as the app's sheet motion) instead of jumping.
          itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(160)}
          contentContainerStyle={styles.searchResultsContent}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListHeaderComponent={
            // The toggle lives with the list it scopes — count left, period right.
            <View style={styles.listMetaRow}>
              <Text style={styles.listMetaText}>
                {rows.length} {rows.length === 1 ? 'BIRDER' : 'BIRDERS'}
              </Text>
              <View style={styles.periodSegment}>
                <Pressable
                  style={[styles.periodBtn, period === 'all' && styles.periodBtnActive]}
                  onPress={() => setPeriod('all')}
                >
                  <Text style={[styles.periodText, period === 'all' && styles.periodTextActive]}>All time</Text>
                </Pressable>
                <Pressable
                  style={[styles.periodBtn, period === 'year' && styles.periodBtnActive]}
                  onPress={() => setPeriod('year')}
                >
                  <Text style={[styles.periodText, period === 'year' && styles.periodTextActive]}>This year</Text>
                </Pressable>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            // Person left, stats right as fixed columns — the numbers line up
            // down the list so friends are comparable at a glance, and a row
            // can never wrap. No controls in the row: tap opens the profile,
            // long-press opens follow/notification actions.
            <Pressable
              style={styles.flockRow}
              onPress={() => goToProfile(item.uid)}
              onLongPress={() => openActions(item)}
            >
              <Avatar name={item.avatarName} seed={item.uid} size={44} round />
              <Text style={styles.flockName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.statCol}>
                <Text style={styles.statColNum}>{item.species}</Text>
                <Text style={styles.statColLabel}>SPECIES</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statColNum}>{item.sightings}</Text>
                <Text style={styles.statColLabel}>SIGHTINGS</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statColNum}>{item.photos}</Text>
                <Text style={styles.statColLabel}>PHOTOS</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Long-press actions: notification level + unfollow for one friend */}
      <BottomSheet visible={actionFor !== null} onClose={() => setActionFor(null)}>
        <View style={styles.actionSheet}>
          <View style={styles.sheetHeader}>
            {actionFor && <Avatar name={actionFor.avatarName} seed={actionFor.uid} size={34} round />}
            <Text style={styles.sheetTitle} numberOfLines={1}>{actionFor?.name}</Text>
          </View>

          <Text style={styles.sheetSectionLabel}>NOTIFICATIONS</Text>
          {NOTIF_OPTIONS.map((opt) => {
            const on = actionFor ? modeFor(actionFor.uid) === opt.mode : false;
            return (
              <Pressable
                key={opt.mode}
                style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
                onPress={() => actionFor && handleSelectMode(actionFor.uid, opt.mode)}
              >
                <View style={styles.sheetRowIcon}>
                  <BellGlyph mode={opt.mode} size={17} color={bellColor(opt.mode)} />
                </View>
                <View style={styles.sheetRowText}>
                  <Text style={styles.sheetRowTitle}>{opt.title}</Text>
                  <Text style={styles.sheetRowSub}>{opt.sub}</Text>
                </View>
                {on && <Ionicons name="checkmark" size={18} color={palette.leaf} />}
              </Pressable>
            );
          })}

          <View style={styles.sheetDivider} />

          <Pressable
            style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            onPress={() => actionFor && handleUnfollow(actionFor)}
          >
            <View style={styles.sheetRowIcon}>
              <Ionicons name="person-remove-outline" size={18} color={palette.crimson} />
            </View>
            <Text style={[styles.sheetRowTitle, { color: palette.crimson }]}>Unfollow</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  headerSection: {
    paddingTop: space.lg,
    paddingHorizontal: space.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  title: {
    ...type.h1,
    color: palette.ink,
    fontWeight: '700',
  },

  // List meta row — birder count left, period toggle right
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  listMetaText: {
    ...type.mono,
    color: palette.inkSoft,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  periodSegment: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    ...border.thick,
    borderRadius: radius.pill,
    padding: 2,
  },
  periodBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  periodBtnActive: {
    backgroundColor: palette.ink,
  },
  periodText: {
    fontFamily: font.display,
    fontSize: 11,
    fontWeight: '700',
    color: palette.inkSoft,
    letterSpacing: -0.2,
  },
  periodTextActive: {
    color: palette.cream,
  },

  // Search bar — fills the row to the right of the title
  searchShadow: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    ...border.thick,
  },
  searchTrailing: {
    marginLeft: space.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: font.body,
    fontSize: 15,
    color: palette.ink,
  },

  // Full-page birder rows (shared by search results and the flock list)
  searchResultsContent: {
    paddingBottom: space.xl,
  },
  resultCount: {
    ...type.mono,
    color: palette.inkSoft,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  searchHintWrap: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    alignItems: 'center',
  },
  searchHintText: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
  },
  birderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  birderInfo: {
    flex: 1,
    minWidth: 0,
  },
  birderName: {
    fontFamily: font.display,
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.4,
  },
  birderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  birderHandle: {
    fontFamily: font.mono,
    fontSize: 11,
    color: palette.inkSoft,
    flexShrink: 1,
  },
  birderDot: {
    color: palette.muted,
  },
  birderSpecies: {
    fontFamily: font.bodyBold,
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.leaf,
  },
  notFollowingTag: {
    fontFamily: font.mono,
    fontSize: 9,
    color: palette.inkSoft,
    letterSpacing: 0.5,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.rule,
    borderRadius: radius.pill,
    paddingVertical: 1,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },

  // Flock rows — person left, aligned stat columns right
  flockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  flockName: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.display,
    fontSize: 17,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.4,
  },
  statCol: {
    width: 58,
    alignItems: 'center',
  },
  statColNum: {
    fontFamily: font.displayBlack,
    fontSize: 17,
    color: palette.ink,
    letterSpacing: -0.5,
  },
  statColLabel: {
    fontFamily: font.mono,
    fontSize: 8,
    color: palette.inkSoft,
    letterSpacing: 0.7,
    marginTop: 2,
  },

  // Long-press action sheet
  actionSheet: {
    backgroundColor: palette.cream,
    borderTopWidth: 2,
    borderColor: palette.ink,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: space.md,
  },
  sheetTitle: {
    fontFamily: font.display,
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  sheetSectionLabel: {
    fontFamily: font.mono,
    fontSize: 9,
    color: palette.inkSoft,
    letterSpacing: 0.8,
    marginBottom: space.xs,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.input,
  },
  sheetRowPressed: {
    backgroundColor: palette.card,
  },
  sheetRowIcon: {
    width: 24,
    alignItems: 'center',
  },
  sheetRowText: {
    flex: 1,
  },
  sheetRowTitle: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '700',
  },
  sheetRowSub: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 1,
  },
  sheetDivider: {
    height: 1.5,
    backgroundColor: palette.rule,
    marginVertical: space.sm,
  },

  // Loading + empty
  loadingContainer: {
    padding: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  loadingText: {
    ...type.body,
    color: palette.inkSoft,
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
