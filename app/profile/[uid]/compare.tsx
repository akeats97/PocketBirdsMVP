import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, DimensionValue, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../../components/social/Avatar';
import { auth } from '../../../config/firebaseConfig';
import { font, palette, radius, space } from '../../../constants/Colors';
import { useSightings } from '../../context/SightingsContext';
import { useWishlist } from '../../context/WishlistContext';
import { getPublicProfile } from '../../services/userService';
import { getSightingsByUid, isPermissionDenied } from '../../services/sightingService';
import { Sighting } from '../../types';
import { compareLists, hintFor, latestBySpecies } from '../../utils/compareLists';

type BucketKey = 'them' | 'you' | 'both';

function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export default function CompareScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Header-less screen: own the top inset on both platforms (the root
  // SafeAreaView only insets the horizontal edges now).
  const topInset = insets.top;

  const myUid = auth.currentUser?.uid;
  const { sightings: mySightings } = useSightings();
  const { wishlist, toggle: toggleWishlist } = useWishlist();

  const [name, setName] = useState('');
  const [myName, setMyName] = useState('You');
  const [theirSightings, setTheirSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  // PL-1: their list is unreadable (private account this user doesn't follow).
  // Normally unreachable (the profile hides the CompareCard), but deep links
  // and stale navigation can land here.
  const [locked, setLocked] = useState(false);
  // Each bucket collapses on header tap; all expanded by default.
  const [collapsed, setCollapsed] = useState<Record<BucketKey, boolean>>({ them: false, you: false, both: false });
  const toggleBucket = (k: BucketKey) => setCollapsed(prev => ({ ...prev, [k]: !prev[k] }));

  useEffect(() => {
    let cancelled = false;
    if (!uid) return;
    (async () => {
      setLoading(true);
      try {
        const [fetchResult, prof, myProf] = await Promise.all([
          getSightingsByUid(uid).then(
            (s) => ({ sightings: s, denied: false }),
            (err) => {
              if (isPermissionDenied(err)) return { sightings: [] as Sighting[], denied: true };
              throw err;
            },
          ),
          getPublicProfile(uid),
          myUid ? getPublicProfile(myUid) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setTheirSightings(fetchResult.sightings);
          setLocked(fetchResult.denied);
          setName(prof?.username ?? '');
          if (myProf?.username) setMyName(myProf.username);
        }
      } catch (err) {
        console.error('Failed to load compare data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, myUid]);

  const c = useMemo(() => compareLists(mySightings, theirSightings), [mySightings, theirSightings]);
  const theirLatest = useMemo(() => latestBySpecies(theirSightings), [theirSightings]);
  const myLatest = useMemo(() => latestBySpecies(mySightings), [mySightings]);

  const union = c.union || 1;
  const pct = (v: number): DimensionValue => `${(v / union) * 100}%`;

  return (
    <View style={styles.screen}>
      {/* Nav */}
      <View style={[styles.navRow, { paddingTop: topInset + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.navLeft}>
          <Ionicons name="chevron-back" size={20} color={palette.ink} />
          <Text style={styles.navLabel}>{(name || 'their').toUpperCase()}&apos;S PROFILE</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.leaf} />
          <Text style={styles.loadingText}>Comparing lists…</Text>
        </View>
      ) : locked ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="lock-closed-outline" size={28} color={palette.inkSoft} />
          <Text style={styles.loadingText}>
            {`${name || 'This birder'}'s sightings are private. Follow them first, then come compare.`}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.avatarStack}>
              <View style={styles.avatarTop}>
                <Avatar name={myName} seed={myUid ?? 'you'} size={56} round />
              </View>
              <View style={styles.avatarBack}>
                <Avatar name={name} seed={uid ?? ''} size={56} round />
              </View>
            </View>
            <Text style={styles.overlapPct}>{c.overlap}%</Text>
            <Text style={styles.heroSub}>
              You share <Text style={styles.heroStrong}>{c.shared}</Text> of your combined <Text style={styles.heroStrong}>{c.union}</Text> species
            </Text>

            {/* tri bar */}
            <View style={styles.heroBar}>
              <View style={[styles.barSeg, { width: pct(c.onlyYou), backgroundColor: palette.sky }]} />
              <View style={[styles.barSeg, { width: pct(c.shared), backgroundColor: palette.sun }]} />
              <View style={[styles.barSeg, { width: pct(c.onlyThem), backgroundColor: palette.coral }]} />
            </View>
            <View style={styles.heroLegend}>
              <View style={styles.legendItem}><Dot color={palette.sky} /><Text style={styles.legendText}>{c.onlyYou} you</Text></View>
              <View style={styles.legendItem}><Dot color={palette.sun} /><Text style={styles.legendText}>{c.shared} shared</Text></View>
              <View style={styles.legendItem}><Dot color={palette.coral} /><Text style={styles.legendText} numberOfLines={1}>{c.onlyThem} {name}</Text></View>
            </View>
          </View>

          {/* Bucket 1 — only them (lead with the chase) */}
          <BucketHeader
            color={palette.coral}
            title={`Only ${name || 'they'} ${name ? 'has' : 'have'}`}
            count={c.onlyThem}
            sub="Your next targets"
            collapsed={collapsed.them}
            onToggle={() => toggleBucket('them')}
          />
          {!collapsed.them && (
            <View style={styles.bucketBody}>
              {c.onlyThemList.map(speciesName => {
                const added = wishlist.has(speciesName);
                return (
                  <SpeciesRow
                    key={speciesName}
                    name={speciesName}
                    hint={hintFor(theirLatest.get(speciesName.toLowerCase()))}
                    action="wishlist"
                    added={added}
                    onAction={() => toggleWishlist(speciesName)}
                  />
                );
              })}
              {c.onlyThem === 0 && <Text style={styles.bucketEmpty}>You&apos;ve seen everything {name || 'they'} has. 🎉</Text>}
            </View>
          )}

          {/* Bucket 2 — only you */}
          <BucketHeader
            color={palette.sky}
            title="Only you have"
            count={c.onlyYou}
            sub={`${name || 'They'} ${name ? 'is' : 'are'} missing these`}
            collapsed={collapsed.you}
            onToggle={() => toggleBucket('you')}
          />
          {!collapsed.you && (
            <View style={styles.bucketBody}>
              {c.onlyYouList.map(speciesName => (
                <SpeciesRow
                  key={speciesName}
                  name={speciesName}
                  hint={hintFor(myLatest.get(speciesName.toLowerCase()))}
                  action="logged"
                />
              ))}
              {c.onlyYou === 0 && <Text style={styles.bucketEmpty}>{name || 'They'} {name ? 'has' : 'have'} everything you have.</Text>}
            </View>
          )}

          {/* Bucket 3 — both (chips) */}
          <BucketHeader
            color={palette.sun}
            title="You both have"
            count={c.shared}
            sub="Common ground"
            collapsed={collapsed.both}
            onToggle={() => toggleBucket('both')}
          />
          {!collapsed.both && (
            <View style={styles.chipsBody}>
              {c.sharedList.map(speciesName => (
                <View key={speciesName} style={styles.sharedChip}>
                  <Text style={styles.sharedChipText}>{speciesName}</Text>
                </View>
              ))}
              {c.shared === 0 && <Text style={styles.bucketEmpty}>No species in common yet.</Text>}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function BucketHeader({ color, title, count, sub, collapsed, onToggle }: {
  color: string;
  title: string;
  count: number;
  sub: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.bucketHeader} onPress={onToggle}>
      <View style={[styles.bucketDot, { backgroundColor: color }]} />
      <View style={styles.bucketHeaderText}>
        <Text style={styles.bucketTitle}>
          {title} <Text style={styles.bucketCount}>· {count}</Text>
        </Text>
        <Text style={styles.bucketSub}>{sub}</Text>
      </View>
      <Ionicons
        name={collapsed ? 'chevron-down' : 'chevron-up'}
        size={18}
        color={palette.inkSoft}
      />
    </Pressable>
  );
}

function SpeciesRow({ name, hint, action, added, onAction }: {
  name: string;
  hint: string;
  action: 'wishlist' | 'logged';
  added?: boolean;
  onAction?: () => void;
}) {
  return (
    <View style={styles.speciesRow}>
      <View style={styles.speciesInfo}>
        <Text style={styles.speciesName} numberOfLines={1}>{name}</Text>
        {hint ? (
          <View style={styles.speciesHintRow}>
            <Ionicons name="location" size={10} color={palette.inkSoft} />
            <Text style={styles.speciesHint} numberOfLines={1}>{hint}</Text>
          </View>
        ) : null}
      </View>
      {action === 'wishlist' ? (
        <Pressable
          style={[styles.wishlistPill, added && styles.wishlistPillAdded]}
          onPress={onAction}
        >
          <Ionicons name={added ? 'star' : 'star-outline'} size={13} color={palette.sun} />
          <Text style={styles.wishlistText}>{added ? 'Wishlisted' : 'Wishlist'}</Text>
        </Pressable>
      ) : (
        <View style={styles.loggedTag}>
          <Ionicons name="checkmark" size={13} color={palette.leaf} />
          <Text style={styles.loggedText}>LOGGED</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.sm },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLabel: { fontFamily: font.mono, fontSize: 11, color: palette.inkSoft, letterSpacing: 1 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  loadingText: { fontFamily: font.body, fontSize: 14, color: palette.inkSoft },

  scrollContent: { paddingBottom: space.xxl },

  // Hero
  hero: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg, alignItems: 'center' },
  avatarStack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  avatarTop: { zIndex: 2 },
  avatarBack: { marginLeft: -16, zIndex: 1 },
  overlapPct: {
    fontFamily: font.displayBlack,
    fontSize: 40,
    color: palette.ink,
    letterSpacing: -2,
    marginTop: space.md,
  },
  heroSub: { fontFamily: font.body, fontSize: 13, color: palette.inkSoft, fontWeight: '500', marginTop: 4, textAlign: 'center' },
  heroStrong: { fontFamily: font.bodyBold, color: palette.ink },
  heroBar: {
    flexDirection: 'row',
    height: 14,
    width: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: palette.ink,
    marginTop: space.lg,
    backgroundColor: palette.card,
  },
  barSeg: { height: '100%' },
  heroLegend: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 9, gap: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  legendText: { fontFamily: font.mono, fontSize: 11, color: palette.inkSoft },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: palette.ink },

  // Bucket header
  bucketHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm },
  bucketDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: palette.ink, flexShrink: 0 },
  bucketHeaderText: { flex: 1 },
  bucketTitle: { fontFamily: font.display, fontSize: 16, fontWeight: '700', color: palette.ink, letterSpacing: -0.3 },
  bucketCount: { color: palette.inkSoft },
  bucketSub: { fontFamily: font.body, fontSize: 11, color: palette.inkSoft, marginTop: 1 },
  bucketBody: { paddingHorizontal: space.xl },
  bucketEmpty: { fontFamily: font.body, fontSize: 12.5, color: palette.inkSoft, paddingVertical: space.sm },

  // Species row
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: space.sm + 1,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  speciesInfo: { flex: 1, minWidth: 0 },
  speciesName: { fontFamily: font.display, fontSize: 14.5, fontWeight: '700', color: palette.ink, letterSpacing: -0.2 },
  speciesHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  speciesHint: { fontFamily: font.body, fontSize: 11, color: palette.inkSoft, flexShrink: 1 },
  wishlistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.ink,
    backgroundColor: palette.card,
    flexShrink: 0,
  },
  wishlistPillAdded: { backgroundColor: palette.sunSoft },
  wishlistText: { fontFamily: font.body, fontSize: 11, fontWeight: '700', color: palette.ink },
  loggedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  loggedText: { fontFamily: font.mono, fontSize: 10.5, fontWeight: '600', color: palette.leaf, letterSpacing: 0.5 },

  moreRow: { fontFamily: font.mono, fontSize: 11.5, color: palette.inkSoft, fontWeight: '500', paddingVertical: space.sm + 2 },

  // Shared chips
  chipsBody: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: space.xl },
  sharedChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    borderColor: palette.ink,
    backgroundColor: palette.sunSoft,
  },
  sharedChipText: { fontFamily: font.body, fontSize: 11.5, fontWeight: '600', color: palette.ink },
  chipsMore: { fontFamily: font.mono, fontSize: 11, color: palette.inkSoft, alignSelf: 'center', paddingVertical: 5, paddingHorizontal: 4 },
});
