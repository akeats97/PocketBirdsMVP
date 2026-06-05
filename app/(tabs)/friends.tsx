import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Modal, Pressable, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FriendSightingCard from '../../components/FriendSightingCard';
import { HardShadow } from '../../components/SightingCard';
import { Avatar } from '../../components/social/Avatar';
import { auth } from '../../config/firebaseConfig';
import { border, font, palette, radius, recipes, space, type } from '../../constants/Colors';
import { isReportEntry } from '../../constants/reportTypes';
import { isCustomSpecies } from '../../constants/customSpecies';
import { useFriendSightings } from '../context/FriendSightingsContext';
import { useSightings } from '../context/SightingsContext';
import { groupSightingsByDay } from '../utils/groupSightingsByDay';
import { FriendSighting } from '../types';
import { DEFAULT_MODE, NotificationMode, setPref, subscribeToPrefs } from '../services/notificationPrefsService';
import { UserProfile, followUser, isFollowing, searchUsers, unfollowUser } from '../services/userService';

interface SearchResultUser extends UserProfile {
  isFollowing?: boolean;
}

// Bell icon + tint for each notification mode.
function bellIconProps(mode: NotificationMode): {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
} {
  switch (mode) {
    case 'all':
      return { name: 'notifications', color: palette.sun };
    case 'none':
      return { name: 'notifications-off', color: palette.muted };
    case 'highlights':
    default:
      return { name: 'notifications-outline', color: palette.ink };
  }
}

const PREF_OPTIONS: { mode: NotificationMode; title: string; sub: string }[] = [
  { mode: 'all', title: 'All sightings', sub: 'Push every time.' },
  { mode: 'highlights', title: 'Highlights only', sub: 'New species and milestones.' },
  { mode: 'none', title: 'Nothing', sub: 'Silent, but still in your feed.' },
];

export default function FriendsScreen() {
  const { friendSightings, friends, filterByFriend, isLoadingFriends, refreshFriends, isFirstSightingForFriend } = useFriendSightings();
  const { isNewSpeciesForUser, sightings: ownSightings } = useSightings();
  const [searchQuery, setSearchQuery] = useState('');
  // 'sightings' = friends' bird sightings (day-grouped). 'feedback' = all Bug
  // Report / Feature Request entries, including the user's own (which are
  // hidden from their Field Journal but surfaced here).
  const [feedMode, setFeedMode] = useState<'sightings' | 'feedback'>('sightings');
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, NotificationMode>>({});
  const [prefPickerFor, setPrefPickerFor] = useState<{ uid: string; name: string } | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  // Stores the pending blur-close timer so refocusing the input can cancel it
  // (e.g. when the X button refocuses after clearing the search).
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    return friends.filter(friend =>
      friend.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, friends]);

  const filteredSightings = useMemo(() => {
    return filterByFriend(searchQuery);
  }, [searchQuery, filterByFriend]);

  // Sightings feed: friends' real bird sightings (reports live in the Feedback
  // view instead). Bucketed into day sections, same as the Field Journal.
  const sightingItems = useMemo(
    () => filteredSightings.filter(s => !isReportEntry(s.birdName)),
    [filteredSightings]
  );
  const sections = useMemo(() => groupSightingsByDay(sightingItems), [sightingItems]);

  // The user's own Bug Report / Feature Request entries, shaped like a friend
  // sighting so they render in the Feedback view. They stay hidden from the
  // Field Journal; this is the one place a user can see what they submitted.
  const ownReports = useMemo<FriendSighting[]>(
    () => ownSightings
      .filter(s => isReportEntry(s.birdName))
      .map(s => ({ ...s, friendName: 'You' })),
    [ownSightings]
  );

  // Feedback feed: everyone's reports (friends' + own), newest first. The
  // friend filter narrows the friend reports; own reports are included unless
  // the filter text doesn't match "You".
  const reportItems = useMemo<FriendSighting[]>(() => {
    const friendReports = filteredSightings.filter(s => isReportEntry(s.birdName));
    const q = searchQuery.trim().toLowerCase();
    const own = q ? ownReports.filter(r => r.friendName.toLowerCase().includes(q)) : ownReports;
    return [...own, ...friendReports].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredSightings, ownReports, searchQuery]);

  const friendStats = useMemo(() => {
    if (feedMode !== 'sightings' || !searchQuery) return null;
    // Exclude Bug Report / Feature Request entries from the counts — they still
    // show as cards in the feed, but aren't real sightings/species.
    const sightings = filterByFriend(searchQuery).filter(s => !isReportEntry(s.birdName));
    const totalSightings = sightings.length;
    // Custom easter-egg species (e.g. Kelsey) don't add to the species count.
    const uniqueSpecies = new Set(
      sightings.filter(s => !isCustomSpecies(s.birdName)).map(s => s.birdName)
    ).size;
    return { totalSightings, uniqueSpecies };
  }, [searchQuery, filterByFriend]);

  const openSearchModal = () => setIsSearchModalVisible(true);

  const closeSearchModal = () => {
    setIsSearchModalVisible(false);
    setModalSearchQuery('');
    setSearchResults([]);
    refreshFriends();
  };

  const handleSearchUsers = async (text: string) => {
    setModalSearchQuery(text);
    if (text.length >= 2) {
      setIsSearching(true);
      try {
        const results = await searchUsers(text);
        const resultsWithFollowing = await Promise.all(
          results.map(async (user) => {
            const following = await isFollowing(user.uid);
            return {
              ...user,
              isFollowing: following,
            };
          })
        );
        setSearchResults(resultsWithFollowing);
      } catch (error) {
        console.error('Error searching users:', error);
        Alert.alert('Error', 'Failed to search for users. Please try again.');
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleFollowAction = async (user: SearchResultUser) => {
    if (actionInProgress === user.uid) return;
    setActionInProgress(user.uid);
    try {
      if (user.isFollowing) {
        await unfollowUser(user.uid);
        setSearchResults(prev => prev.map(u => u.uid === user.uid ? { ...u, isFollowing: false } : u));
      } else {
        await followUser(user.uid);
        setSearchResults(prev => prev.map(u => u.uid === user.uid ? { ...u, isFollowing: true } : u));
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      Alert.alert('Error', `Failed to ${user.isFollowing ? 'unfollow' : 'follow'} user. Please try again.`);
    } finally {
      setActionInProgress(null);
    }
  };

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

  // Keep a live map of the current user's per-friend notification modes.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return subscribeToPrefs(uid, setNotificationPrefs);
  }, []);

  const modeFor = (uid: string): NotificationMode => notificationPrefs[uid] ?? DEFAULT_MODE;

  const handleSelectMode = async (followedUid: string, mode: NotificationMode) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const previous = notificationPrefs[followedUid];
    // Optimistic: update the map and close the picker, revert on failure.
    setNotificationPrefs(prev => ({ ...prev, [followedUid]: mode }));
    setPrefPickerFor(null);
    try {
      await setPref(uid, followedUid, mode);
    } catch (error) {
      console.error('Failed to save notification preference:', error);
      setNotificationPrefs(prev => ({ ...prev, [followedUid]: previous ?? DEFAULT_MODE }));
      Alert.alert('Error', "Couldn't save that preference. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Friends</Text>
          <HardShadow offset={3} borderRadius={radius.pill}>
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && { backgroundColor: palette.inkSoft }]}
              onPress={openSearchModal}
            >
              <Ionicons name="person-add" size={14} color={palette.cream} />
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </HardShadow>
        </View>

        {/* Feed mode toggle: friends' sightings vs everyone's feedback */}
        <View style={styles.feedPillsRow}>
          <Pressable
            style={[styles.feedPill, feedMode === 'sightings' && styles.feedPillActive]}
            onPress={() => setFeedMode('sightings')}
          >
            <Ionicons
              name="leaf"
              size={14}
              color={feedMode === 'sightings' ? palette.cream : palette.ink}
            />
            <Text style={[styles.feedPillText, feedMode === 'sightings' && styles.feedPillTextActive]}>
              Sightings
            </Text>
          </Pressable>
          <Pressable
            style={[styles.feedPill, feedMode === 'feedback' && styles.feedPillActive]}
            onPress={() => setFeedMode('feedback')}
          >
            <Ionicons
              name="chatbox-ellipses"
              size={14}
              color={feedMode === 'feedback' ? palette.cream : palette.ink}
            />
            <Text style={[styles.feedPillText, feedMode === 'feedback' && styles.feedPillTextActive]}>
              Hep
            </Text>
          </Pressable>
        </View>

        {/* Friends filter search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={palette.inkSoft} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Filter by friend..."
            placeholderTextColor={palette.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              if (blurCloseTimerRef.current) {
                clearTimeout(blurCloseTimerRef.current);
                blurCloseTimerRef.current = null;
              }
              setShowFriendsList(true);
            }}
            onBlur={() => {
              // Delay so taps inside the dropdown (friend row, X button) can
              // refocus the input before the dropdown disappears. onFocus
              // cancels the timer if a refocus happens first.
              blurCloseTimerRef.current = setTimeout(() => {
                setShowFriendsList(false);
                blurCloseTimerRef.current = null;
              }, 150);
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                // User is still in search mode — keep the dropdown open and
                // the input focused so they can pick another friend or type
                // a new filter. Refocusing also cancels any pending blur-close.
                searchInputRef.current?.focus();
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={palette.inkSoft} />
            </TouchableOpacity>
          )}
        </View>

        {/* Friend stats panel — shown when a friend is selected */}
        {friendStats && (
          <View style={styles.statsWrap}>
            <HardShadow borderRadius={radius.card}>
              <View style={styles.statsPanel}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{friendStats.totalSightings}</Text>
                  <Text style={styles.statLabel}>Sightings</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{friendStats.uniqueSpecies}</Text>
                  <Text style={styles.statLabel}>Species</Text>
                </View>
              </View>
            </HardShadow>
          </View>
        )}

        {/* Friends list dropdown */}
        {showFriendsList && (
          <View style={styles.friendsListWrap}>
            <HardShadow borderRadius={radius.card}>
              <View style={styles.friendsList}>
                {isLoadingFriends ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={palette.leaf} />
                    <Text style={styles.loadingText}>Loading friends...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredFriends}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <View style={styles.friendRow}>
                        <Pressable
                          style={styles.friendRowContent}
                          onPress={() => {
                            Keyboard.dismiss();
                            setSearchQuery(item.name);
                            setShowFriendsList(false);
                          }}
                        >
                          <Avatar name={item.name} seed={item.id} size={36} />
                          <Text style={styles.friendName} numberOfLines={1}>{item.name}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.bellButton}
                          onPress={() => setPrefPickerFor({ uid: item.id, name: item.name })}
                        >
                          <Ionicons {...bellIconProps(modeFor(item.id))} size={18} />
                        </Pressable>
                      </View>
                    )}
                    ListEmptyComponent={
                      <Text style={styles.emptyText}>
                        {searchQuery ? 'No friends match your search' : "You're not following anyone yet"}
                      </Text>
                    }
                  />
                )}
              </View>
            </HardShadow>
          </View>
        )}
      </View>

      {/* Feed: sightings (day-grouped) or feedback (flat) / empty / loading */}
      {isLoadingFriends && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.leaf} />
          <Text style={styles.loadingText}>Loading friend activity...</Text>
        </View>
      ) : feedMode === 'feedback' ? (
        reportItems.length === 0 ? (
          <View style={styles.emptyState}>
            <HardShadow>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No feedback yet.</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? `No bug reports or feature requests from "${searchQuery}".`
                    : 'Bug reports and feature requests (yours and your friends’) show up here.'}
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
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        )
      ) : sightingItems.length === 0 ? (
        <View style={styles.emptyState}>
          <HardShadow>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No sightings found.</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `Nothing from "${searchQuery}" yet.`
                  : friends.length > 0
                    ? "Your friends haven't shared any sightings yet."
                    : 'Follow some friends to see their sightings here.'}
              </Text>
              {friends.length === 0 && (
                <HardShadow offset={3} borderRadius={radius.input} style={{ marginTop: space.md }}>
                  <Pressable
                    style={({ pressed }) => [styles.findFriendsButton, pressed && { backgroundColor: palette.ink }]}
                    onPress={openSearchModal}
                  >
                    <Text style={styles.findFriendsButtonText}>Find Friends</Text>
                  </Pressable>
                </HardShadow>
              )}
            </View>
          </HardShadow>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FriendSightingCard
              sighting={item}
              isFirstSighting={isFirstSightingForFriend(item.friendName, item.birdName, item.date)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{section.title}</Text>
              <Text style={styles.dayCounts}>
                {section.sightingCount} {section.sightingCount === 1 ? 'sighting' : 'sightings'} · {section.speciesCount} {section.speciesCount === 1 ? 'species' : 'species'}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Add friends modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isSearchModalVisible}
        onRequestClose={closeSearchModal}
      >
        <View style={styles.modalContainer}>
          <HardShadow borderRadius={radius.card}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Find Users to Follow</Text>
                <Pressable
                  onPress={closeSearchModal}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={20} color={palette.ink} />
                </Pressable>
              </View>

              <View style={styles.modalSearchContainer}>
                <Ionicons name="search" size={18} color={palette.inkSoft} style={styles.searchIcon} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search by username..."
                  placeholderTextColor={palette.muted}
                  value={modalSearchQuery}
                  onChangeText={handleSearchUsers}
                  autoFocus={true}
                />
                {modalSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setModalSearchQuery('');
                      setSearchResults([]);
                    }}
                    style={styles.clearButton}
                  >
                    <Ionicons name="close-circle" size={20} color={palette.inkSoft} />
                  </TouchableOpacity>
                )}
              </View>

              {isSearching ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={palette.leaf} />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              ) : (
                <>
                  {modalSearchQuery.length > 0 ? (
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.uid}
                      renderItem={({ item }) => (
                        <View style={styles.searchResultItem}>
                          <View style={styles.userInfo}>
                            <Avatar name={item.username} seed={item.uid} size={40} />
                            <Text style={styles.username} numberOfLines={1}>{item.username}</Text>
                          </View>
                          <View style={styles.actionButtons}>
                            {item.isFollowing && (
                              <Pressable
                                style={styles.bellButton}
                                onPress={() => setPrefPickerFor({ uid: item.uid, name: item.username })}
                              >
                                <Ionicons {...bellIconProps(modeFor(item.uid))} size={20} />
                              </Pressable>
                            )}
                            <Pressable
                              style={({ pressed }) => [
                                styles.followButton,
                                item.isFollowing && styles.followingButton,
                                pressed && { opacity: 0.85 },
                              ]}
                              onPress={() => handleFollowAction(item)}
                              disabled={actionInProgress === item.uid}
                            >
                              {actionInProgress === item.uid ? (
                                <ActivityIndicator size="small" color={item.isFollowing ? palette.ink : palette.cream} />
                              ) : (
                                <Text style={[styles.followButtonText, item.isFollowing && styles.followingButtonText]}>
                                  {item.isFollowing ? 'Following' : 'Follow'}
                                </Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      )}
                      ListEmptyComponent={
                        <Text style={styles.emptyText}>No users found</Text>
                      }
                    />
                  ) : (
                    <View style={styles.searchPromptContainer}>
                      <Ionicons name="people-outline" size={48} color={palette.muted} />
                      <Text style={styles.searchPromptText}>Search for users to follow</Text>
                      <Text style={styles.searchPromptSubtext}>
                        Enter a username to find other birders.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </HardShadow>
        </View>
      </Modal>

      {/* Per-friend notification preference picker */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={prefPickerFor !== null}
        onRequestClose={() => setPrefPickerFor(null)}
      >
        <Pressable style={styles.prefBackdrop} onPress={() => setPrefPickerFor(null)}>
          <Pressable style={styles.prefSheet} onPress={() => {}}>
            <Text style={styles.prefTitle} numberOfLines={1}>
              Notifications from {prefPickerFor?.name}
            </Text>
            {PREF_OPTIONS.map(opt => {
              const active = prefPickerFor ? modeFor(prefPickerFor.uid) === opt.mode : false;
              return (
                <Pressable
                  key={opt.mode}
                  style={[styles.prefOption, active && styles.prefOptionActive]}
                  onPress={() => prefPickerFor && handleSelectMode(prefPickerFor.uid, opt.mode)}
                >
                  <Ionicons {...bellIconProps(opt.mode)} size={22} style={styles.prefOptionIcon} />
                  <View style={styles.prefOptionTextWrap}>
                    <Text style={styles.prefOptionTitle}>{opt.title}</Text>
                    <Text style={styles.prefOptionSub}>{opt.sub}</Text>
                  </View>
                  {active && <Ionicons name="checkmark" size={20} color={palette.leaf} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
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
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  title: {
    ...type.h1,
    color: palette.ink,
    fontWeight: '700',
  },

  // Add button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: palette.ink,
    ...border.thick,
  },
  addButtonText: {
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: '700',
    color: palette.cream,
    letterSpacing: -0.2,
  },

  // Feed mode pills
  feedPillsRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  feedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
    ...border.thick,
  },
  feedPillActive: {
    backgroundColor: palette.ink,
  },
  feedPillText: {
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  feedPillTextActive: {
    color: palette.cream,
  },

  // Avatar
  // Search bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    ...border.thick,
    marginBottom: space.md,
  },
  searchIcon: {
    marginRight: space.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: font.body,
    fontSize: 15,
    color: palette.ink,
  },
  clearButton: {
    padding: 4,
  },

  // Stats panel
  statsWrap: {
    marginBottom: space.md,
  },
  statsPanel: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...border.thick,
  },
  statItem: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...type.h2,
    color: palette.ink,
    fontWeight: '700',
  },
  statLabel: {
    ...type.label,
    color: palette.inkSoft,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: palette.rule,
  },

  // Friends list dropdown
  friendsListWrap: {
    marginBottom: space.md,
    zIndex: 10,
  },
  friendsList: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    ...border.thick,
    maxHeight: 220,
    overflow: 'hidden',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  friendRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: space.md,
  },
  friendName: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '600',
    flex: 1,
  },
  bellButton: {
    padding: 6,
  },

  // Loading + empty
  loadingContainer: {
    padding: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  loadingRow: {
    padding: space.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
  },
  loadingText: {
    ...type.body,
    color: palette.inkSoft,
  },
  emptyText: {
    padding: space.lg,
    textAlign: 'center',
    ...type.body,
    color: palette.inkSoft,
  },
  listContent: {
    paddingVertical: space.sm,
    paddingBottom: space.xl,
  },
  dayHeader: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    backgroundColor: palette.cream,
  },
  dayTitle: {
    ...type.h3,
    color: palette.ink,
    fontWeight: '700',
  },
  dayCounts: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 2,
    fontWeight: '500',
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

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(26, 36, 23, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.lg,
  },
  modalContent: {
    ...recipes.card,
    width: '100%',
    maxWidth: 380,
    height: '78%',
    padding: space.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1.5,
    borderBottomColor: palette.ink,
  },
  modalTitle: {
    ...type.h2,
    color: palette.ink,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    ...border.thick,
    marginBottom: space.md,
  },
  modalSearchInput: {
    flex: 1,
    height: 44,
    fontFamily: font.body,
    fontSize: 15,
    color: palette.ink,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
    gap: space.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: space.md,
  },
  username: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '600',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  followButton: {
    backgroundColor: palette.leaf,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    ...border.thick,
    minWidth: 90,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: palette.card,
  },
  followButtonText: {
    fontFamily: font.display,
    fontWeight: '700',
    fontSize: 12,
    color: '#fff',
    letterSpacing: -0.2,
  },
  followingButtonText: {
    color: palette.ink,
  },
  searchPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.lg,
    gap: space.sm,
  },
  searchPromptText: {
    ...type.h3,
    color: palette.ink,
    marginTop: space.md,
  },
  searchPromptSubtext: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
  },

  // Notification preference picker
  prefBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 36, 23, 0.5)',
    justifyContent: 'flex-end',
  },
  prefSheet: {
    ...recipes.card,
    padding: space.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  prefTitle: {
    ...type.h3,
    color: palette.ink,
    marginBottom: space.md,
  },
  prefOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.input,
  },
  prefOptionActive: {
    backgroundColor: palette.card,
    ...border.thick,
  },
  prefOptionIcon: {
    width: 24,
    textAlign: 'center',
  },
  prefOptionTextWrap: {
    flex: 1,
  },
  prefOptionTitle: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '700',
  },
  prefOptionSub: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 1,
  },
});
