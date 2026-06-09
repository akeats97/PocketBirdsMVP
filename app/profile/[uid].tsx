import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import CompareCard from '../../components/compare/CompareCard';
import FriendSightingCard from '../../components/FriendSightingCard';
import { HardShadow } from '../../components/SightingCard';
import { Avatar } from '../../components/social/Avatar';
import { SocialCounts, ConnectionTab } from '../../components/social/SocialCounts';
import { auth } from '../../config/firebaseConfig';
import { font, palette, radius, space, type } from '../../constants/Colors';
import { isReportEntry } from '../../constants/reportTypes';
import { useSightings } from '../context/SightingsContext';
import { followUser, getFollowCounts, getPublicProfile, isFollowing, PublicProfile, unfollowUser } from '../services/userService';
import { getSightingsByUid } from '../services/sightingService';
import { FriendSighting, Sighting } from '../types';
import { sightingCount, speciesSet } from '../utils/compareLists';
import { groupSightingsByDay } from '../utils/groupSightingsByDay';
import { buildUserDex } from '../utils/userDex';

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

export default function ProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Header-less screen: own the top inset on both platforms (the root
  // SafeAreaView only insets the horizontal edges now).
  const topInset = insets.top;

  const myUid = auth.currentUser?.uid;
  const isSelf = !!uid && uid === myUid;

  const { sightings: mySightings, clearLocalData } = useSightings();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [theirSightings, setTheirSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('journal');
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });

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
  }), [sightings]);

  const liferIds = useMemo(() => computeLiferIds(sightings), [sightings]);

  // Render the journal with the full FriendSightingCard (tap → sighting detail,
  // social footer). Map to the FriendSighting shape; the owner tag is hidden on
  // a profile since whose page it is, is already clear.
  const journalSections = useMemo(() => {
    const tagged: FriendSighting[] = sightings
      .filter(s => !isReportEntry(s.birdName))
      .map(s => ({ ...s, friendName: isSelf ? 'You' : (name || 'Birder') }));
    return groupSightingsByDay(tagged);
  }, [sightings, isSelf, name]);

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
    } catch (err) {
      console.error('Follow toggle failed:', err);
      setFollowing(!next); // revert
      Alert.alert('Error', `Couldn't ${next ? 'follow' : 'unfollow'} ${name || 'this user'}. Please try again.`);
    } finally {
      setFollowBusy(false);
    }
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
      {/* Identity */}
      <View style={styles.identity}>
        <Avatar name={avatarName} seed={uid ?? ''} size={72} />
        <View style={styles.identityCol}>
          <Text style={styles.name} numberOfLines={1}>{name || 'Birder'}</Text>
          {since && <Text style={styles.since}>Since {since}</Text>}
        </View>
        <ActionPill
          variant={isSelf ? 'edit' : following ? 'friends' : 'follow'}
          busy={followBusy}
          onPress={isSelf
            ? () => Alert.alert('Coming soon', 'Profile editing is on the way.')
            : handleFollowToggle}
        />
      </View>

      {/* Social graph — tappable Followers / Following on every profile */}
      <SocialCounts
        followers={followCounts.followers}
        following={followCounts.following}
        onOpen={(t: ConnectionTab) => router.push(`/profile/${uid}/connections?tab=${t}`)}
      />

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
      {/* Nav row */}
      <View style={[styles.navRow, { paddingTop: topInset + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.navLeft}>
          <Ionicons name="chevron-back" size={20} color={palette.ink} />
          <Text style={styles.navLabel}>{isSelf ? 'POCKET BIRDS' : 'FRIENDS'}</Text>
        </Pressable>
        {isSelf ? (
          <Pressable onPress={handleLogout} hitSlop={8} style={styles.logoutPill}>
            <Ionicons name="log-out-outline" size={14} color={palette.crimson} />
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        ) : (
          <Ionicons name="ellipsis-horizontal" size={18} color={palette.inkSoft} />
        )}
      </View>

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
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{section.title}</Text>
              <Text style={styles.dayCounts}>
                {section.sightingCount} {section.sightingCount === 1 ? 'sighting' : 'sightings'} · {section.speciesCount} {section.speciesCount === 1 ? 'species' : 'species'}
              </Text>
            </View>
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
                <View key={fam.family} style={styles.dexFamily}>
                  <View style={styles.dexFamilyHeader}>
                    <Text style={styles.dexFamilyName}>{fam.family}</Text>
                    <Text style={styles.dexFamilyCount}>{fam.seen}/{fam.total}</Text>
                  </View>
                  <View style={styles.dexBarTrack}>
                    <View style={[styles.dexBarFill, { width: `${Math.min(100, (fam.seen / Math.max(1, fam.total)) * 100)}%` }]} />
                  </View>
                  <View style={styles.dexChips}>
                    {fam.species.map(sp => (
                      <View key={sp.name} style={styles.dexChip}>
                        {sp.globalFirst && <Ionicons name="trophy" size={10} color={palette.sun} />}
                        <Text style={styles.dexChipText}>{sp.name}</Text>
                        {sp.count > 1 && <Text style={styles.dexChipCount}>×{sp.count}</Text>}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Action pill (Follow / Friends / Edit) ───────────────────────────────────
function ActionPill({ variant, busy, onPress }: {
  variant: 'follow' | 'friends' | 'edit';
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
              name={variant === 'edit' ? 'pencil' : variant === 'friends' ? 'checkmark' : 'add'}
              size={variant === 'follow' ? 14 : 13}
              color={isFollow ? '#fff' : palette.ink}
            />
            <Text style={[styles.pillText, isFollow && styles.pillTextFollow]}>
              {variant === 'edit' ? 'Edit' : variant === 'friends' ? 'Friends' : 'Follow'}
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
    marginTop: 7,
    letterSpacing: 0.2,
  },

  // Action pill
  pillShadow: { flexShrink: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.ink,
    minWidth: 86,
    justifyContent: 'center',
  },
  pillNeutral: { backgroundColor: palette.card },
  pillFollow: { backgroundColor: palette.leaf },
  pillText: { fontFamily: font.display, fontSize: 13, fontWeight: '700', color: palette.ink },
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

  // Day header
  dayHeader: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    backgroundColor: palette.cream,
  },
  dayTitle: { ...type.h3, color: palette.ink, fontWeight: '700' },
  dayCounts: { ...type.bodyS, color: palette.inkSoft, marginTop: 2, fontWeight: '500' },

  // Dex tab
  dexWrap: { paddingHorizontal: space.xl, paddingTop: space.md },
  dexFamily: { marginBottom: space.lg },
  dexFamilyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dexFamilyName: { fontFamily: font.display, fontSize: 14, fontWeight: '700', color: palette.ink, letterSpacing: -0.3 },
  dexFamilyCount: { fontFamily: font.mono, fontSize: 10, color: palette.inkSoft },
  dexBarTrack: {
    height: 8,
    backgroundColor: palette.card,
    borderWidth: 1.5,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: 8,
  },
  dexBarFill: { height: '100%', backgroundColor: palette.leaf },
  dexChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dexChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    borderColor: palette.ink,
    backgroundColor: palette.leafSoft,
  },
  dexChipText: { fontFamily: font.body, fontSize: 11, fontWeight: '600', color: palette.ink },
  dexChipCount: { fontFamily: font.mono, fontSize: 9, color: palette.inkSoft },

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
