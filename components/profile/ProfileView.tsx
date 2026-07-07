import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from '@react-native-firebase/auth';
import CompareCard from '../compare/CompareCard';
import FriendSightingCard from '../FriendSightingCard';
import { DayHeader } from '../journal/DayHeader';
import { DexCompactFamily } from '../dex/DexCompactFamily';
import { HardShadow } from '../SightingCard';
import { Avatar } from '../social/Avatar';
import { NotifBell } from '../social/NotifBell';
import { NotifPrefSheet } from '../social/NotifPrefSheet';
import { auth } from '../../config/firebaseConfig';
import { font, palette, radius, space, type } from '../../constants/Colors';
import { isReportEntry } from '../../constants/reportTypes';
import { useSightings } from '../../app/context/SightingsContext';
import { useFriendSightings } from '../../app/context/FriendSightingsContext';
import { blockUser, unblockUser } from '../../app/services/moderationService';
import { BottomSheet } from '../BottomSheet';
import { ReportSheet } from '../ReportSheet';
import { DEFAULT_MODE, NotificationMode, setPref, subscribeToPrefs } from '../../app/services/notificationPrefsService';
import { followUser, getFollowCounts, getPublicProfile, isFollowing, PublicProfile, unfollowUser } from '../../app/services/userService';
import { getSightingsByUid } from '../../app/services/sightingService';
import { FriendSighting, Sighting } from '../../app/types';
import { sightingCount, speciesSet } from '../../app/utils/compareLists';
import { groupSightingsByDay } from '../../app/utils/groupSightingsByDay';
import { useCollapsedDays } from '../../app/utils/useCollapsedDays';
import { buildUserDex } from '../../app/utils/userDex';

type Tab = 'journal' | 'dex';

// Mark the earliest sighting of each species as that user's "1ST" (lifer).
function computeLiferIds(sightings: Sighting[]): Set<string> {
  const earliest = new Map<string, Sighting>();
  for (const s of sightings) {
    if (isReportEntry(s.birdName)) continue;
    const key = s.birdName.toLowerCase();
    const cur = earliest.get(key);
    if (!cur || s.date.getTime() < cur.date.getTime()) earliest.set(key, s);
  }
  return new Set([...earliest.values()].map(s => s.id));
}

interface ProfileViewProps {
  uid: string | undefined;
  /** True when rendered inside the You tab — the AppHeader already owns the
      top inset and there's no stack to go back to, so the nav row drops the
      back chevron and the inset padding. */
  embedded?: boolean;
}

export default function ProfileView({ uid, embedded }: ProfileViewProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Header-less stack screen: own the top inset on both platforms (the root
  // SafeAreaView only insets the horizontal edges now). Embedded in a tab the
  // AppHeader above already pays the inset.
  const topInset = embedded ? 0 : insets.top;

  const myUid = auth.currentUser?.uid;
  const isSelf = !!uid && uid === myUid;

  const { sightings: mySightings, clearLocalData } = useSightings();
  // Following someone here must rebuild the flock/feed so the Friends tab and
  // Journal update without a manual pull-to-refresh.
  const { refreshFriends, blockedUids } = useFriendSightings();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [theirSightings, setTheirSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('journal');
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [notifPrefs, setNotifPrefs] = useState<Record<string, NotificationMode>>({});
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  // Moderation (PL-2): the ⋯ next to the Follow pill on someone else's profile.
  const [modSheetOpen, setModSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const isBlocked = !!uid && blockedUids.has(uid);

  // The list this profile renders: my own (live context) when self, else the
  // fetched list.
  const sightings = isSelf ? mySightings : theirSightings;

  useEffect(() => {
    let cancelled = false;
    if (!uid) return;
    (async () => {
      setLoading(true);
      try {
        if (isSelf) {
          // Reuse the live context for sightings; only fetch the profile meta.
          const fallback = mySightings.length
            ? mySightings.reduce((min, s) => (s.date < min ? s.date : min), mySightings[0].date)
            : null;
          const prof = await getPublicProfile(uid, fallback);
          if (!cancelled) setProfile(prof);
        } else {
          // Fire all three reads at once — the profile meta no longer waits on
          // the sightings fetch. If the user doc has no join date, fill it from
          // the earliest fetched sighting afterward.
          const [fetched, followState, prof] = await Promise.all([
            getSightingsByUid(uid),
            isFollowing(uid),
            getPublicProfile(uid),
          ]);
          if (prof && !prof.joinDate && fetched.length) {
            prof.joinDate = fetched.reduce((min, s) => (s.date < min ? s.date : min), fetched[0].date);
          }
          if (!cancelled) {
            setTheirSightings(fetched);
            setFollowing(followState);
            setProfile(prof);
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // mySightings intentionally excluded — self sightings come from live context
    // and we only need a one-shot fetch on uid change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isSelf]);

  // Follower / following counts (lengths of the lists the counts row opens).
  // Kept separate from the main load so a follow toggle can cheaply refresh it.
  const loadFollowCounts = React.useCallback(() => {
    if (!uid) return;
    getFollowCounts(uid).then(setFollowCounts).catch(() => {});
  }, [uid]);
  useEffect(() => { loadFollowCounts(); }, [loadFollowCounts]);

  // Live map of my per-friend notification levels, so the profile's bell stays
  // in sync with the same control in the connections list.
  useEffect(() => {
    if (!myUid) return;
    return subscribeToPrefs(myUid, setNotifPrefs);
  }, [myUid]);

  const notifMode: NotificationMode = (uid && notifPrefs[uid]) || DEFAULT_MODE;

  const handleSelectNotifMode = async (mode: NotificationMode) => {
    if (!uid || !myUid) return;
    setNotifPrefs((prev) => ({ ...prev, [uid]: mode })); // optimistic
    setNotifSheetOpen(false);
    try {
      await setPref(myUid, uid, mode);
    } catch (e) {
      console.error('Failed to set notification pref:', e);
    }
  };

  // If the profile loaded without a username (the read resolved against a partial
  // cached doc), retry a few times to pick it up once the server doc syncs in.
  // The email-initial fallback covers the avatar in the meantime.
  useEffect(() => {
    if (!uid || !profile || profile.username) return;
    let cancelled = false;
    let attempt = 0;
    const retry = () => {
      if (cancelled || attempt >= 4) return;
      attempt += 1;
      setTimeout(async () => {
        if (cancelled) return;
        const p = await getPublicProfile(uid);
        if (cancelled) return;
        if (p?.username) {
          setProfile((prev) => ({ ...p, joinDate: p.joinDate ?? prev?.joinDate ?? null }));
        } else {
          retry();
        }
      }, 1000 * attempt);
    };
    retry();
    return () => { cancelled = true; };
  }, [uid, profile?.username]);

  const name = profile?.username ?? '';
  // Avatar letter falls back to the email initial so a signed-in profile is
  // never a "?" while the username is briefly empty (partial-cache race). The
  // display name text below still shows 'Birder', never the email.
  const avatarName = name || profile?.email || '';
  const since = profile?.joinDate
    ? profile.joinDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  const stats = useMemo(() => ({
    species: speciesSet(sightings).size,
    sightings: sightingCount(sightings),
    // Same rule as the flock list: real sightings carrying a photo.
    photos: sightings.filter(s => !isReportEntry(s.birdName) && !!s.photoUrl).length,
  }), [sightings]);

  const liferIds = useMemo(() => computeLiferIds(sightings), [sightings]);

  // Render the journal with the full FriendSightingCard (tap → sighting detail,
  // social footer). Map to the FriendSighting shape; the owner tag is hidden on
  // a profile since whose page it is, is already clear.
  const { collapsedDays, toggleDay } = useCollapsedDays();

  const journalSections = useMemo(() => {
    const tagged: FriendSighting[] = sightings
      .filter(s => !isReportEntry(s.birdName))
      .map(s => ({ ...s, friendName: isSelf ? 'You' : (name || 'Birder') }));
    // Collapsed days keep their header (with counts) but render no rows.
    return groupSightingsByDay(tagged).map(s =>
      collapsedDays.has(s.key) ? { ...s, data: [] } : s
    );
  }, [sightings, isSelf, name, collapsedDays]);

  const dexFamilies = useMemo(() => buildUserDex(sightings), [sightings]);

  const handleFollowToggle = async () => {
    if (followBusy || !uid) return;
    const next = !following;
    setFollowing(next); // optimistic
    setFollowBusy(true);
    try {
      if (next) await followUser(uid);
      else await unfollowUser(uid);
      loadFollowCounts(); // their follower count just changed
      refreshFriends(); // rebuild my flock + feed so other tabs update live
    } catch (err) {
      console.error('Follow toggle failed:', err);
      setFollowing(!next); // revert
      Alert.alert('Error', `Couldn't ${next ? 'follow' : 'unfollow'} ${name || 'this user'}. Please try again.`);
    } finally {
      setFollowBusy(false);
    }
  };

  // Block / unblock (PL-2). Blocking runs server-side (the callable also drops
  // the follow edges both directions); unblock is just deleting your own
  // blocked doc. Neither restores anything on unblock, deliberately.
  const handleBlockToggle = () => {
    if (!uid) return;
    setModSheetOpen(false);
    if (isBlocked) {
      unblockUser(uid).catch(() => Alert.alert('Error', "Couldn't unblock. Please try again."));
      return;
    }
    Alert.alert(
      `Block ${name || 'this birder'}?`,
      "They won't be able to hoot, comment, or propose on your sightings, and you'll stop following each other.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(uid);
              setFollowing(false);
              refreshFriends();
            } catch {
              Alert.alert('Error', "Couldn't block. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Log out now lives on your own profile (the app header shows your avatar in
  // its place). Mirrors the old header logout: clear local cache, then sign out
  // — the root auth listener swaps the UI to the login screen.
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

  // Shared header chrome — identity, stat strip, comparison, segmented control.
  // Rendered as the journal SectionList header and atop the dex ScrollView.
  const chrome = (
    <View>
      {/* Identity — the name owns the full row; actions live below it, so a
          long username never fights a pill for space. */}
      <View style={styles.identity}>
        <Avatar name={avatarName} seed={uid ?? ''} size={64} />
        <View style={styles.identityCol}>
          <Text style={styles.name} numberOfLines={1}>{name || 'Birder'}</Text>
          {since && <Text style={styles.since}>Since {since}</Text>}
          {/* Compact, tappable follower counts (replaces the SocialCounts module) */}
          <View style={styles.countsRow}>
            <Pressable hitSlop={6} onPress={() => router.push(`/profile/${uid}/connections?tab=followers`)}>
              <Text style={styles.countText}>
                <Text style={styles.countNum}>{followCounts.followers}</Text> followers
              </Text>
            </Pressable>
            <Text style={styles.countDot}>·</Text>
            <Pressable hitSlop={6} onPress={() => router.push(`/profile/${uid}/connections?tab=following`)}>
              <Text style={styles.countText}>
                <Text style={styles.countNum}>{followCounts.following}</Text> following
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Actions — follow/edit pill + bell. Embedded self profile: edit lives
          in the AppHeader's ⋯ menu, no row at all. */}
      {!embedded && (
        <View style={styles.actionsRow}>
          <ActionPill
            variant={isSelf ? 'edit' : following ? 'following' : 'follow'}
            busy={followBusy}
            onPress={isSelf
              ? () => Alert.alert('Coming soon', 'Profile editing is on the way.')
              : handleFollowToggle}
          />
          {!isSelf && following && (
            // Raised like its pill neighbor — on this row the bell is a
            // surface-level control, not an inline list chip.
            <HardShadow offset={2} borderRadius={17} style={styles.pillShadow}>
              <NotifBell mode={notifMode} onPress={() => setNotifSheetOpen(true)} />
            </HardShadow>
          )}
          {!isSelf && (
            // Moderation ⋯ (report / block). Raised to match its row neighbors.
            <HardShadow offset={2} borderRadius={17} style={styles.pillShadow}>
              <Pressable
                style={styles.modChip}
                onPress={() => setModSheetOpen(true)}
                hitSlop={6}
                accessibilityLabel="More options"
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={palette.ink} />
              </Pressable>
            </HardShadow>
          )}
        </View>
      )}

      {/* Stat strip */}
      <View style={styles.statWrap}>
        <HardShadow offset={4} borderRadius={radius.card}>
          <View style={styles.statStrip}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{stats.species}</Text>
              <Text style={styles.statLabel}>SPECIES</Text>
            </View>
            <View style={styles.statCellDivided}>
              <Text style={styles.statValue}>{stats.sightings}</Text>
              <Text style={styles.statLabel}>SIGHTINGS</Text>
            </View>
            <View style={styles.statCellDivided}>
              <Text style={styles.statValue}>{stats.photos}</Text>
              <Text style={styles.statLabel}>PHOTOS</Text>
            </View>
          </View>
        </HardShadow>
      </View>

      {/* Comparison module — non-self only */}
      {!isSelf && (
        <View style={styles.compareWrap}>
          <CompareCard
            me={mySightings}
            them={theirSightings}
            name={name || 'them'}
            onPress={() => router.push(`/profile/${uid}/compare`)}
          />
        </View>
      )}

      {/* Segmented control */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          <SegmentButton label="Field Journal" active={tab === 'journal'} onPress={() => setTab('journal')} />
          <SegmentButton label="Bird Dex" active={tab === 'dex'} onPress={() => setTab('dex')} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Nav row — only for stack-pushed profiles. The You tab's edit/logout
          actions live in the AppHeader above it instead, so embedded mode
          starts straight at the identity block. */}
      {!embedded && (
        <View style={[styles.navRow, { paddingTop: topInset + space.sm }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.navLeft}>
            <Ionicons name="chevron-back" size={20} color={palette.ink} />
            <Text style={styles.navLabel}>{isSelf ? 'POCKET BIRDS' : 'FRIENDS'}</Text>
          </Pressable>
          {isSelf && (
            <Pressable onPress={handleLogout} hitSlop={8} style={styles.logoutPill}>
              <Ionicons name="log-out-outline" size={14} color={palette.crimson} />
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          )}
        </View>
      )}

      {loading && !profile ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.leaf} />
        </View>
      ) : tab === 'journal' ? (
        // Journal is virtualized (a user can have hundreds of image cards).
        <SectionList
          sections={journalSections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={chrome}
          renderItem={({ item }) => (
            <FriendSightingCard
              sighting={item}
              isFirstSighting={liferIds.has(item.id)}
              hideTag
            />
          )}
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyCard
              title={isSelf ? 'Nothing logged yet.' : 'No sightings yet.'}
              subtitle={isSelf ? 'Tap the + below when you see something.' : `${name || 'This birder'} hasn't logged anything yet.`}
            />
          }
        />
      ) : (
        // Dex tab — bounded to this user's seen species; a ScrollView is fine.
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {chrome}
          {dexFamilies.length === 0 ? (
            <EmptyCard
              title="No species yet."
              subtitle={isSelf ? 'Your Bird Dex fills in as you log species.' : `${name || 'This birder'} hasn't identified any species yet.`}
            />
          ) : (
            <View style={styles.dexWrap}>
              {dexFamilies.map(fam => (
                <DexCompactFamily
                  key={fam.family}
                  family={fam.family}
                  seen={fam.seen}
                  total={fam.total}
                  species={fam.species.map(sp => ({
                    name: sp.name,
                    seen: true,
                    count: sp.count,
                    globalFirst: sp.globalFirst,
                  }))}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <NotifPrefSheet
        visible={notifSheetOpen}
        person={uid ? { uid, username: name } : null}
        mode={notifMode}
        onPick={handleSelectNotifMode}
        onClose={() => setNotifSheetOpen(false)}
      />

      {/* Moderation sheet (PL-2): report / block, non-self profiles only. */}
      <BottomSheet visible={modSheetOpen} onClose={() => setModSheetOpen(false)}>
        <View style={[styles.modSheet, { paddingBottom: insets.bottom + space.xl }]}>
          <Pressable
            style={({ pressed }) => [styles.modRow, pressed && { backgroundColor: palette.card }]}
            onPress={() => {
              setModSheetOpen(false);
              // Stagger so the two sheets don't cross mid-animation.
              setTimeout(() => setReportOpen(true), 280);
            }}
          >
            <Ionicons name="flag-outline" size={20} color={palette.ink} />
            <Text style={styles.modRowText}>Report {name || 'this birder'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.modRow, pressed && { backgroundColor: palette.card }]}
            onPress={handleBlockToggle}
          >
            <Ionicons
              name={isBlocked ? 'lock-open-outline' : 'hand-left-outline'}
              size={20}
              color={isBlocked ? palette.ink : palette.crimson}
            />
            <Text style={[styles.modRowText, !isBlocked && { color: palette.crimson }]}>
              {isBlocked ? `Unblock ${name || 'this birder'}` : `Block ${name || 'this birder'}`}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      {uid && (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="user"
          targetId={uid}
          targetLabel={name ? `@${name}` : 'this birder'}
        />
      )}
    </View>
  );
}

// ── Action pill (Follow / Following / Edit) ──────────────────────────────────
function ActionPill({ variant, busy, onPress }: {
  variant: 'follow' | 'following' | 'edit';
  busy?: boolean;
  onPress: () => void;
}) {
  const isFollow = variant === 'follow';
  return (
    <HardShadow offset={2} borderRadius={radius.pill} style={styles.pillShadow}>
      <Pressable
        style={[styles.pill, isFollow ? styles.pillFollow : styles.pillNeutral]}
        onPress={onPress}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator size="small" color={isFollow ? palette.cream : palette.ink} />
        ) : (
          <>
            <Ionicons
              name={variant === 'edit' ? 'pencil' : variant === 'following' ? 'checkmark' : 'add'}
              size={variant === 'follow' ? 14 : 13}
              color={isFollow ? '#fff' : palette.ink}
            />
            <Text style={[styles.pillText, isFollow && styles.pillTextFollow]}>
              {variant === 'edit' ? 'Edit' : variant === 'following' ? 'Following' : 'Follow'}
            </Text>
          </>
        )}
      </Pressable>
    </HardShadow>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.segmentBtn, active && styles.segmentBtnActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.emptyWrap}>
      <HardShadow>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{title}</Text>
          <Text style={styles.emptySubtitle}>{subtitle}</Text>
        </View>
      </HardShadow>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLabel: { fontFamily: font.mono, fontSize: 11, color: palette.inkSoft, letterSpacing: 1 },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    boxShadow: `2px 2px 0 ${palette.ink}`,
  },
  logoutText: {
    fontFamily: font.display,
    fontSize: 12.5,
    fontWeight: '700',
    color: palette.crimson,
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: space.xxl },

  // Identity
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.xs,
  },
  identityCol: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    color: palette.ink,
    letterSpacing: -1,
  },
  since: {
    fontFamily: font.mono,
    fontSize: 11.5,
    color: palette.inkSoft,
    marginTop: 5,
    letterSpacing: 0.2,
  },

  // Compact follower / following line
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  countText: {
    ...type.bodyS,
    color: palette.inkSoft,
  },
  countNum: {
    fontFamily: font.bodyBold,
    fontWeight: '700',
    color: palette.ink,
  },
  countDot: {
    color: palette.muted,
  },

  // Actions row under the identity block
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },

  // Action pill
  pillShadow: { flexShrink: 0 },
  // Moderation ⋯ chip + sheet (PL-2)
  modChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modSheet: {
    backgroundColor: palette.cream,
    borderTopWidth: 2,
    borderColor: palette.ink,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.input,
  },
  modRowText: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '700',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.ink,
    justifyContent: 'center',
  },
  pillNeutral: { backgroundColor: palette.card },
  pillFollow: { backgroundColor: palette.leaf },
  pillText: { fontFamily: font.display, fontSize: 12.5, fontWeight: '700', color: palette.ink },
  pillTextFollow: { color: '#fff' },

  // Stat strip
  statWrap: { paddingHorizontal: space.xl, paddingTop: space.lg },
  statStrip: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: palette.ink,
    paddingVertical: space.md,
    elevation: 0,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statCellDivided: {
    flex: 1,
    alignItems: 'center',
    borderLeftWidth: 1.5,
    borderLeftColor: palette.rule,
  },
  statValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    color: palette.ink,
    letterSpacing: -0.8,
  },
  statLabel: {
    fontFamily: font.mono,
    fontSize: 9,
    color: palette.inkSoft,
    letterSpacing: 0.8,
    marginTop: 5,
  },

  compareWrap: { paddingHorizontal: space.xl, paddingTop: space.md },

  // Segmented control
  segmentWrap: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm },
  segment: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  segmentBtnActive: { backgroundColor: palette.ink },
  segmentText: { fontFamily: font.display, fontSize: 13, fontWeight: '700', color: palette.inkSoft, letterSpacing: -0.2 },
  segmentTextActive: { color: palette.cream },

  // Dex tab
  dexWrap: { paddingTop: space.md },

  // Empty
  emptyWrap: { alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.xl },
  emptyCard: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: palette.ink,
    padding: space.xl,
    alignItems: 'center',
    minWidth: 260,
    elevation: 0,
  },
  emptyTitle: { ...type.h2, color: palette.ink, marginBottom: space.xs, textAlign: 'center' },
  emptySubtitle: { ...type.body, color: palette.inkSoft, textAlign: 'center' },
});
