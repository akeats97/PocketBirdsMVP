import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SightingCard, { HardShadow } from '../../components/SightingCard';
import { Avatar } from '../../components/social/Avatar';
import { familyForBird } from '../../constants/birdNames';
import { font, palette, radius, space } from '../../constants/Colors';
import { isReportEntry } from '../../constants/reportTypes';
import { useSightings } from '../context/SightingsContext';
import { useWishlist } from '../context/WishlistContext';
import { CommunityPhoto, getCommunityPhotosForSpecies } from '../services/sightingService';
import { Sighting } from '../types';

type Tab = 'community' | 'yours';

// YOUR relationship to a species, derived from your own sightings + wishlist.
interface Relationship {
  seen: boolean;
  count: number;
  first: boolean; // you were the first birder on Pocket Birds to log it
  wish: boolean;
}

export default function SpeciesScreen() {
  const { name: rawName, tab: tabParam } = useLocalSearchParams<{ name: string; tab?: Tab }>();
  const name = Array.isArray(rawName) ? rawName[0] : rawName ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { sightings } = useSightings();
  const { wishlist } = useWishlist();

  const family = useMemo(() => familyForBird(name), [name]);

  // Your sightings of this species, newest first.
  const mine = useMemo(() => {
    const key = name.toLowerCase();
    return sightings
      .filter(s => !isReportEntry(s.birdName) && s.birdName.toLowerCase() === key)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sightings, name]);

  const rel: Relationship = useMemo(() => ({
    seen: mine.length > 0,
    count: mine.length,
    first: mine.some(s => s.globalFirst && s.verified),
    wish: wishlist.has(name),
  }), [mine, wishlist, name]);

  // Earliest of your sightings carries the "1ST" lifer badge.
  const liferId = useMemo(() => {
    if (mine.length === 0) return null;
    return mine.reduce((earliest, s) => (s.date < earliest.date ? s : earliest), mine[0]).id;
  }, [mine]);

  // Adaptive default: a seen bird leads with your record, an unseen bird leads
  // with discovery. An explicit ?tab= param overrides.
  const [tab, setTab] = useState<Tab>(
    tabParam === 'community' || tabParam === 'yours' ? tabParam : (rel.seen ? 'yours' : 'community')
  );

  const [community, setCommunity] = useState<CommunityPhoto[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [open, setOpen] = useState<CommunityPhoto | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCommunity(true);
    // Community = every photo of this species from anyone, your own included
    // (a full gallery, not an others-only split). The "Yours" tab stays your
    // subset. See WORK_QUEUE Q-13.
    getCommunityPhotosForSpecies(name)
      .then(photos => { if (!cancelled) setCommunity(photos); })
      .catch(err => { console.error('Failed to load community photos:', err); })
      .finally(() => { if (!cancelled) setLoadingCommunity(false); });
    return () => { cancelled = true; };
  }, [name]);

  return (
    <View style={styles.screen}>
      {/* Back nav — you came from the Dex */}
      <View style={[styles.navRow, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.navLeft}>
          <Ionicons name="chevron-back" size={18} color={palette.ink} />
          <Text style={styles.navLabel}>BIRD DEX</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View style={styles.identity}>
          {family && <Text style={styles.family}>{family.toUpperCase()}</Text>}
          <Text style={styles.speciesName}>{name}</Text>
          <View style={styles.chipRow}>
            <StatusChip rel={rel} />
          </View>
        </View>

        {/* Toggle — the spine of the screen */}
        <View style={styles.tabsWrap}>
          <SpeciesTabs
            tab={tab}
            setTab={setTab}
            community={community.length}
            yours={mine.length}
          />
        </View>

        {tab === 'community' ? (
          <CommunityZone
            photos={community}
            loading={loadingCommunity}
            onOpen={setOpen}
          />
        ) : (
          <YourSightingsZone mine={mine} liferId={liferId} rel={rel} name={name} />
        )}
      </ScrollView>

      {open && (
        <Lightbox
          photo={open}
          onClose={() => setOpen(null)}
          onViewProfile={() => { const uid = open.uid; setOpen(null); router.push(`/profile/${uid}`); }}
        />
      )}
    </View>
  );
}

// ─── Status chip — your relationship to this species ────────────────────────
function StatusChip({ rel }: { rel: Relationship }) {
  let bg: string, fg: string, borderColor: string, icon: keyof typeof Ionicons.glyphMap, label: string;
  if (rel.first) {
    bg = palette.sun; fg = palette.ink; borderColor = palette.ink; icon = 'flag'; label = 'First find';
  } else if (rel.seen) {
    bg = palette.leafSoft; fg = palette.leaf; borderColor = palette.leaf; icon = 'checkmark'; label = `Seen ×${rel.count}`;
  } else if (rel.wish) {
    bg = palette.sunSoft; fg = palette.ink; borderColor = palette.sun; icon = 'star'; label = 'On your wishlist';
  } else {
    bg = palette.card; fg = palette.inkSoft; borderColor = palette.rule; icon = 'star-outline'; label = 'Not seen yet';
  }
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor }]}>
      <Ionicons name={icon} size={12} color={fg} />
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ─── Segmented toggle — Community | Yours, with live counts ──────────────────
function SpeciesTabs({ tab, setTab, community, yours }: {
  tab: Tab; setTab: (t: Tab) => void; community: number; yours: number;
}) {
  const Item = ({ id, label, count }: { id: Tab; label: string; count: number }) => {
    const on = tab === id;
    return (
      <Pressable onPress={() => setTab(id)} style={[styles.tabItem, on && styles.tabItemActive]}>
        <Text style={[styles.tabLabel, on && styles.tabLabelActive]}>{label}</Text>
        <View style={[styles.tabBadge, on ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
          <Text style={[styles.tabBadgeText, on && styles.tabBadgeTextActive]}>{count}</Text>
        </View>
      </Pressable>
    );
  };
  return (
    <HardShadow offset={3} borderRadius={radius.pill}>
      <View style={styles.tabBar}>
        <Item id="community" label="Community" count={community} />
        <Item id="yours" label="Yours" count={yours} />
      </View>
    </HardShadow>
  );
}

// ─── Community zone — every birder's photos (yours included) ─────────────────
function CommunityZone({ photos, loading, onOpen }: {
  photos: CommunityPhoto[]; loading: boolean; onOpen: (p: CommunityPhoto) => void;
}) {
  if (loading) {
    return (
      <View style={styles.loadingZone}>
        <ActivityIndicator color={palette.leaf} />
      </View>
    );
  }

  // Sparse / empty — rarely-photographed bird. Invite to be the first.
  if (photos.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <HardShadow offset={4} borderRadius={radius.card}>
          <View style={styles.communityEmptyCard}>
            <Ionicons name="camera" size={24} color={palette.inkSoft} />
            <Text style={styles.communityEmptyTitle}>No community photos yet.</Text>
            <Text style={styles.communityEmptyBody}>
              A rarely-photographed bird. Log it with a photo and you&apos;ll be the first on Pocket Birds.
            </Text>
          </View>
        </HardShadow>
      </View>
    );
  }

  // Mosaic — two columns, staggered heights for a field-guide plate feel.
  // colA leads tall (168,124,168…), colB leads short (124,168,124…).
  const colA = photos.filter((_, i) => i % 2 === 0);
  const colB = photos.filter((_, i) => i % 2 === 1);
  const hFor = (i: number) => (i % 2 === 0 ? 168 : 124);
  return (
    <View style={styles.mosaic}>
      {[colA, colB].map((col, ci) => (
        <View key={ci} style={styles.mosaicCol}>
          {col.map((photo, i) => (
            <CommunityTile
              key={photo.id}
              photo={photo}
              height={hFor(ci === 0 ? i : i + 1)}
              onOpen={onOpen}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function CommunityTile({ photo, height, onOpen }: {
  photo: CommunityPhoto; height: number; onOpen: (p: CommunityPhoto) => void;
}) {
  return (
    <Pressable onPress={() => onOpen(photo)} style={styles.tile}>
      <Image source={{ uri: photo.photoUrl }} style={[styles.tileImage, { height }]} resizeMode="cover" />
      <View style={styles.creditPill}>
        <Avatar name={photo.username} seed={photo.uid} size={18} round />
        <Text style={styles.creditName} numberOfLines={1}>{firstName(photo.username)}</Text>
      </View>
    </Pressable>
  );
}

// ─── Your sightings zone — reuse the Field Journal card verbatim ─────────────
function YourSightingsZone({ mine, liferId, rel, name }: {
  mine: Sighting[]; liferId: string | null; rel: Relationship; name: string;
}) {
  const router = useRouter();
  const { toggle: toggleWishlist } = useWishlist();

  if (mine.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <HardShadow offset={4} borderRadius={radius.card}>
          <View style={styles.yoursEmptyCard}>
            <Text style={styles.yoursEmptyTitle}>You haven&apos;t seen this one yet.</Text>
            <Text style={styles.yoursEmptyBody}>
              When you spot a {name}, log it. Your sightings will gather here.
            </Text>
            <View style={styles.yoursEmptyButtons}>
              <HardShadow offset={3} borderRadius={radius.input} style={styles.flex1}>
                <Pressable style={styles.logButton} onPress={() => router.push('/(tabs)/add')}>
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={styles.logButtonText}>Log it</Text>
                </Pressable>
              </HardShadow>
              <Pressable
                style={[styles.wishButton, rel.wish && styles.wishButtonOn]}
                onPress={() => toggleWishlist(name)}
              >
                <Ionicons name={rel.wish ? 'star' : 'star-outline'} size={16} color={palette.ink} />
                <Text style={styles.wishButtonText}>{rel.wish ? 'On wishlist' : 'Add to wishlist'}</Text>
              </Pressable>
            </View>
          </View>
        </HardShadow>
      </View>
    );
  }

  return (
    <View style={styles.yoursList}>
      {mine.map(s => (
        <SightingCard key={s.id} sighting={s} isNewSpecies={s.id === liferId} />
      ))}
    </View>
  );
}

// ─── Lightbox — photo open, credited, path to the profile ────────────────────
function Lightbox({ photo, onClose, onViewProfile }: {
  photo: CommunityPhoto; onClose: () => void; onViewProfile: () => void;
}) {
  const insets = useSafeAreaInsets();
  const when = photo.date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return (
    <View style={styles.lightbox}>
      <Pressable style={styles.lightboxScrim} onPress={onClose} />

      <Pressable style={[styles.lightboxClose, { top: insets.top + 14 }]} onPress={onClose} hitSlop={8}>
        <Ionicons name="close" size={18} color={palette.cream} />
      </Pressable>

      <View style={styles.lightboxColumn} pointerEvents="box-none">
        <View style={styles.lightboxPhotoWrap}>
          <Image source={{ uri: photo.photoUrl }} style={styles.lightboxPhoto} resizeMode="cover" />
        </View>

        <View style={styles.lightboxCreditWrap}>
          <HardShadow offset={3} borderRadius={radius.card}>
            <View style={styles.lightboxCredit}>
              <View style={styles.lightboxCreditHeader}>
                {/* Avatar + name both route to the profile, not just the button. */}
                <Pressable style={styles.lightboxCreditPerson} onPress={onViewProfile}>
                  <Avatar name={photo.username} seed={photo.uid} size={40} />
                  <View style={styles.lightboxCreditCol}>
                    <Text style={styles.lightboxName} numberOfLines={1}>{photo.username || 'Birder'}</Text>
                    {photo.username ? (
                      <Text style={styles.lightboxHandle} numberOfLines={1}>@{photo.username.toLowerCase()}</Text>
                    ) : null}
                  </View>
                </Pressable>
                <Pressable style={styles.viewProfileBtn} onPress={onViewProfile}>
                  <Text style={styles.viewProfileText}>View profile</Text>
                  <Ionicons name="chevron-forward" size={12} color={palette.cream} />
                </Pressable>
              </View>
              <View style={styles.lightboxMeta}>
                {photo.location ? (
                  <>
                    <View style={styles.lightboxMetaItem}>
                      <Ionicons name="location" size={13} color={palette.leaf} />
                      <Text style={styles.lightboxMetaText}>{photo.location}</Text>
                    </View>
                    <Text style={styles.lightboxMetaDot}>·</Text>
                  </>
                ) : null}
                <Text style={styles.lightboxMetaText}>{when}</Text>
              </View>
            </View>
          </HardShadow>
        </View>
      </View>
    </View>
  );
}

function firstName(name: string): string {
  return (name || 'Birder').trim().split(/\s+/)[0];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  scrollContent: { paddingBottom: space.xxl },

  // Back nav
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.sm },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLabel: { fontFamily: font.mono, fontSize: 11, color: palette.inkSoft, letterSpacing: 1 },

  // Identity
  identity: { paddingHorizontal: space.xl, paddingTop: space.xs },
  family: { fontFamily: font.mono, fontSize: 10.5, color: palette.inkSoft, letterSpacing: 1 },
  speciesName: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    color: palette.ink,
    letterSpacing: -1.1,
    lineHeight: 31,
    marginTop: 5,
  },
  chipRow: { flexDirection: 'row', marginTop: 11 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingLeft: 9,
    paddingRight: 11,
  },
  chipText: { fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 0.2 },

  // Toggle
  tabsWrap: { paddingHorizontal: space.xl, paddingTop: space.md + 2, paddingBottom: space.sm },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  tabItemActive: { backgroundColor: palette.ink },
  tabLabel: { fontFamily: font.display, fontSize: 14, fontWeight: '700', color: palette.inkSoft, letterSpacing: -0.2 },
  tabLabelActive: { color: palette.cream },
  tabBadge: {
    minWidth: 20,
    alignItems: 'center',
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tabBadgeActive: { borderColor: palette.cream },
  tabBadgeInactive: { borderColor: palette.rule },
  tabBadgeText: { fontFamily: font.mono, fontSize: 10.5, color: palette.inkSoft },
  tabBadgeTextActive: { color: palette.ink },

  // Community
  loadingZone: { paddingTop: space.xxl, alignItems: 'center' },
  mosaic: { flexDirection: 'row', gap: 10, paddingHorizontal: space.xl, paddingTop: space.sm + 2 },
  mosaicCol: { flex: 1, gap: 12 },
  tile: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.leafSoft,
    boxShadow: `3px 3px 0 ${palette.ink}`,
  },
  tileImage: { width: '100%' },
  creditPill: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '90%',
    backgroundColor: 'rgba(26, 36, 23, 0.82)',
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingLeft: 2,
    paddingRight: 9,
  },
  creditName: { fontFamily: font.bodyBold, fontSize: 10.5, color: palette.cream, letterSpacing: 0.2, flexShrink: 1 },

  // Empty states
  emptyWrap: { paddingHorizontal: space.xl, paddingTop: space.lg },
  communityEmptyCard: {
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: 4,
  },
  communityEmptyTitle: { fontFamily: font.display, fontSize: 17, fontWeight: '700', color: palette.ink, marginTop: 2 },
  communityEmptyBody: {
    fontFamily: font.body,
    fontSize: 13,
    color: palette.inkSoft,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 230,
  },

  yoursEmptyCard: {
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.card,
    padding: space.xl,
    alignItems: 'center',
  },
  yoursEmptyTitle: { fontFamily: font.display, fontSize: 19, fontWeight: '700', color: palette.ink, textAlign: 'center' },
  yoursEmptyBody: {
    fontFamily: font.body,
    fontSize: 13.5,
    color: palette.inkSoft,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 19.5,
    maxWidth: 250,
  },
  yoursEmptyButtons: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, width: '100%' },
  flex1: { flex: 1 },
  logButton: {
    backgroundColor: palette.leaf,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.input,
    paddingVertical: 11,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  logButtonText: { fontFamily: font.display, fontSize: 14, fontWeight: '700', color: '#fff' },
  wishButton: {
    flex: 1,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.input,
    paddingVertical: 11,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wishButtonOn: { backgroundColor: palette.sunSoft },
  wishButtonText: { fontFamily: font.display, fontSize: 14, fontWeight: '700', color: palette.ink },

  // Your sightings list — SightingCard owns its own horizontal margins.
  yoursList: { paddingTop: space.sm, paddingBottom: space.xs },

  // Lightbox
  lightbox: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' },
  lightboxScrim: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 20, 13, 0.86)' },
  lightboxClose: {
    position: 'absolute',
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(253, 246, 230, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxColumn: { width: '86%' },
  lightboxPhotoWrap: { borderRadius: radius.card, overflow: 'hidden', borderWidth: 2, borderColor: palette.cream },
  lightboxPhoto: { width: '100%', height: 250, backgroundColor: palette.inkSoft },
  lightboxCreditWrap: { marginTop: 12 },
  lightboxCredit: {
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.card,
    padding: space.md,
    boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
  },
  lightboxCreditHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lightboxCreditPerson: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lightboxCreditCol: { flex: 1, minWidth: 0 },
  lightboxName: { fontFamily: font.display, fontSize: 16, fontWeight: '700', color: palette.ink, lineHeight: 18 },
  lightboxHandle: { fontFamily: font.mono, fontSize: 11, color: palette.inkSoft, marginTop: 2 },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  viewProfileText: { fontFamily: font.display, fontSize: 12.5, fontWeight: '700', color: palette.cream },
  lightboxMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.rule,
  },
  lightboxMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  lightboxMetaText: { fontFamily: font.body, fontSize: 12.5, fontWeight: '500', color: palette.inkSoft, flexShrink: 1 },
  lightboxMetaDot: { color: palette.muted },
});
