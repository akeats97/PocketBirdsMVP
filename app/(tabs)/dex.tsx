import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ClearableInput from '../../components/ClearableInput';
import { HardShadow } from '../../components/SightingCard';
import { HoloFill, HoloRing } from '../../components/Holo';
import { birdFamilies, REGION_CODES, REGION_LABELS, RegionCode } from '../../constants/birdNames';
import { latinFor } from '../../constants/birdLatin';
import { border, font, palette, radius, recipes, space, type } from '../../constants/Colors';
import { isReportEntry } from '../../constants/reportTypes';
import { isUnknownEntry } from '../../constants/unknownBird';
import { isCustomSpecies } from '../../constants/customSpecies';
import { useSightings } from '../context/SightingsContext';
import { useWishlist } from '../context/WishlistContext';

type FilterMode = 'all' | 'seen' | 'wishlist';

type SeenInfo = { timesSeen: number; lastSeen: string; hasPhoto: boolean; photoUrl?: string; isGlobalFirst: boolean };

// One species' card data, pre-resolved for render.
type VisBird = {
  name: string;
  seen: boolean;
  times: number;
  hasPhoto: boolean;
  photoUrl?: string;
  globalFirst: boolean;
  wished: boolean;
  mystery: boolean;
  navigable: boolean;
  latin: string;
};
type FamView = { family: string; seen: number; total: number; birds: VisBird[] };

const REGIONS_STORAGE_KEY = 'dex.selectedRegions.v1';
const ALL_REGIONS: RegionCode[] = [...REGION_CODES];

function nextMilestone(count: number): number {
  if (count < 5) return 5;
  if (count < 10) return 10;
  if (count < 25) return 25;
  if (count < 50) return 50;
  return Math.ceil((count + 1) / 50) * 50;
}

function prevMilestone(count: number): number {
  if (count < 1) return 0;
  if (count < 5) return 1;
  if (count < 10) return 5;
  if (count < 25) return 10;
  if (count < 50) return 25;
  return Math.floor(count / 50) * 50;
}

export default function DexScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('seen');
  const [selectedRegions, setSelectedRegions] = useState<RegionCode[]>(ALL_REGIONS);
  const [regionsModalOpen, setRegionsModalOpen] = useState(false);
  // Collapsed families, keyed by family name. Lifted out of the card so the
  // FlatList can recycle region cards without losing/confusing collapse state.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const { sightings } = useSightings();
  const { wishlist, toggle: toggleWishlist } = useWishlist();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REGIONS_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((r): r is RegionCode =>
            (ALL_REGIONS as string[]).includes(r)
          );
          if (valid.length > 0) setSelectedRegions(valid);
        }
      } catch {}
    })();
  }, []);

  const persistRegions = (next: RegionCode[]) => {
    setSelectedRegions(next);
    AsyncStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const toggleRegion = (code: RegionCode) => {
    persistRegions(
      selectedRegions.includes(code)
        ? selectedRegions.filter(r => r !== code)
        : [...selectedRegions, code]
    );
  };

  const toggleFamily = useCallback((family: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  }, []);

  // Exclude Bug Report / Feature Request entries — they aren't real species
  // and shouldn't appear in the Dex or its stats.
  const realSightings = useMemo(
    () => sightings.filter(s => !isReportEntry(s.birdName)),
    [sightings]
  );

  const seenMap = useMemo(() => {
    const map: { [name: string]: SeenInfo } = {};
    realSightings.forEach(s => {
      // "Mystery Bird" entries DO get a card (under "Other") showing how many
      // you've logged, but they're kept out of the species headline count (see
      // `stats` below) since they have no identified species.
      const entry = map[s.birdName] || { timesSeen: 0, lastSeen: '', hasPhoto: false, isGlobalFirst: false };
      entry.timesSeen += 1;
      const d = s.date.toISOString().split('T')[0];
      if (!entry.lastSeen || d > entry.lastSeen) entry.lastSeen = d;
      if (s.photoUrl) {
        entry.hasPhoto = true;
        if (!entry.photoUrl) entry.photoUrl = s.photoUrl;
      }
      // Gold "first on Pocket Birds" only shows once an admin has verified the
      // claim (a photographed, real sighting) — guards against joke logs.
      if (s.globalFirst && s.verified) entry.isGlobalFirst = true;
      map[s.birdName] = entry;
    });
    return map;
  }, [realSightings]);

  // Custom easter-egg species (e.g. Kelsey) get a Dex card (via the orphan
  // "Other" path below) but are kept out of the headline species counts.
  const stats = useMemo(() => {
    const realSpeciesNames = Object.keys(seenMap).filter(n => !isCustomSpecies(n) && !isUnknownEntry(n));
    // Mystery Bird sightings have no identified species (so they never count
    // toward species), but each one logged with a photo still counts as
    // something photographed — one per mystery sighting, not one per "species".
    const mysteryPhotos = realSightings.filter(s => isUnknownEntry(s.birdName) && s.photoUrl).length;
    return {
      totalSightings: realSightings.length,
      uniqueSpecies: realSpeciesNames.length,
      photographedSpecies: realSpeciesNames.filter(n => seenMap[n].hasPhoto).length + mysteryPhotos,
    };
  }, [realSightings, seenMap]);

  // Species ADDED to the life list this calendar year (first-ever sighting
  // falls in this year), the hero's "+N this year" stat. Not the same as
  // species seen this year, which would also count old friends revisited.
  const newSpeciesThisYear = useMemo(() => {
    const year = new Date().getFullYear();
    const firstSeen = new Map<string, number>();
    realSightings.forEach(s => {
      if (isCustomSpecies(s.birdName) || isUnknownEntry(s.birdName)) return;
      const key = s.birdName.toLowerCase();
      const t = s.date.getTime();
      const prev = firstSeen.get(key);
      if (prev === undefined || t < prev) firstSeen.set(key, t);
    });
    let count = 0;
    firstSeen.forEach(t => {
      if (new Date(t).getFullYear() === year) count += 1;
    });
    return count;
  }, [realSightings]);

  const families = useMemo<FamView[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const selSet = new Set(selectedRegions);
    const out: FamView[] = [];
    const canonical = new Set<string>();

    const inRegion = (regions: RegionCode[]) =>
      regions.length === 0 || regions.some(r => selSet.has(r));
    const passesRegion = (regions: RegionCode[], visible: boolean) =>
      visible || inRegion(regions);

    const toVisBird = (name: string): VisBird => {
      const info = seenMap[name];
      const seen = !!info;
      const mystery = isUnknownEntry(name);
      return {
        name,
        seen,
        times: info?.timesSeen ?? 0,
        hasPhoto: info?.hasPhoto ?? false,
        photoUrl: info?.photoUrl,
        globalFirst: info?.isGlobalFirst ?? false,
        wished: wishlist.has(name),
        mystery,
        navigable: !mystery && !isCustomSpecies(name),
        latin: latinFor(name),
      };
    };

    for (const fam of birdFamilies) {
      const filtered: VisBird[] = [];
      let familySeen = 0;
      let familyTotal = 0;
      for (const b of fam.birds) {
        canonical.add(b.name);
        const seen = !!seenMap[b.name];
        const wished = wishlist.has(b.name);
        if (inRegion(b.regions)) {
          familyTotal += 1;
          if (seen) familySeen += 1;
        }
        if (filter === 'seen' && !seen) continue;
        if (filter === 'wishlist' && !wished) continue;
        if (filter === 'all' && !passesRegion(b.regions, seen || wished)) continue;
        if (q && !b.name.toLowerCase().includes(q)) continue;
        filtered.push(toVisBird(b.name));
      }
      if (filtered.length === 0) continue;
      out.push({ family: fam.family, seen: familySeen, total: familyTotal, birds: filtered });
    }

    // Orphan names: anything in the user's seen map OR wishlist that isn't in
    // the canonical IOC list. Show them under "Other" if they pass the filter.
    const orphanCandidates = new Set<string>();
    for (const name of Object.keys(seenMap)) if (!canonical.has(name)) orphanCandidates.add(name);
    for (const name of wishlist) if (!canonical.has(name)) orphanCandidates.add(name);

    const orphans = Array.from(orphanCandidates)
      .filter((name) => {
        const seen = !!seenMap[name];
        const wished = wishlist.has(name);
        if (filter === 'seen' && !seen) return false;
        if (filter === 'wishlist' && !wished) return false;
        return true;
      })
      .filter((name) => !q || name.toLowerCase().includes(q))
      .sort()
      .map(toVisBird);

    if (orphans.length) {
      out.push({ family: 'Other', seen: orphans.length, total: orphans.length, birds: orphans });
    }

    return out;
  }, [searchQuery, filter, seenMap, selectedRegions, wishlist]);

  const regionsLabel =
    selectedRegions.length === ALL_REGIONS.length
      ? 'All regions'
      : selectedRegions.length === 0
        ? 'No regions'
        : `${selectedRegions.length} region${selectedRegions.length === 1 ? '' : 's'}`;

  const onPressSpecies = useCallback(
    (name: string) => router.push({ pathname: '/species/[name]', params: { name } }),
    [router]
  );

  const renderFamily = useCallback(({ item }: { item: FamView }) => (
    <FamilyRegionCard
      fam={item}
      open={!collapsed.has(item.family)}
      // Under the Seen filter the hidden cards are exactly the unseen species,
      // so "N still out there" reads literally. Other filters show everything
      // that qualifies, so there's nothing meaningful left to count.
      stillOut={filter === 'seen' ? Math.max(0, item.total - item.seen) : 0}
      onToggle={toggleFamily}
      onToggleWishlist={toggleWishlist}
      onPressSpecies={onPressSpecies}
    />
  ), [collapsed, filter, toggleFamily, toggleWishlist, onPressSpecies]);

  const keyExtractor = useCallback((item: FamView) => item.family, []);

  const milestoneNext = nextMilestone(stats.uniqueSpecies);
  const milestonePrev = prevMilestone(stats.uniqueSpecies);
  const litSegments = Math.max(0, Math.min(10, Math.floor(
    ((stats.uniqueSpecies - milestonePrev) / Math.max(1, milestoneNext - milestonePrev)) * 10
  )));

  const header = (
    <View style={styles.headerSection}>
      <Text style={styles.title}>Bird Dex</Text>

      <View style={styles.heroWrap}>
        <HardShadow borderRadius={radius.card}>
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              {/* Lifetime species is THE headline metric */}
              <View style={styles.lifeCol}>
                <Text style={styles.lifeNumber}>{stats.uniqueSpecies}</Text>
                <Text style={styles.lifeLabel}>LIFETIME SPECIES</Text>
              </View>

              {/* Supporting stats */}
              <View style={styles.heroStats}>
                <View style={styles.heroStatRow}>
                  <Text style={styles.heroStatLabel}>THIS YEAR</Text>
                  <Text style={styles.heroStatSmall}>+{newSpeciesThisYear}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatRow}>
                  <Text style={styles.heroStatLabel}>SIGHTINGS</Text>
                  <Text style={styles.heroStatSmall}>{stats.totalSightings}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatRow}>
                  <View style={styles.heroStatLabelRow}>
                    <Ionicons name="camera" size={10} color={palette.sun} style={{ marginRight: 4 }} />
                    <Text style={styles.heroStatLabel}>PHOTOGRAPHED</Text>
                  </View>
                  <Text style={styles.heroStatSmall}>{stats.photographedSpecies}</Text>
                </View>
              </View>
            </View>

            {/* Milestone track — the shipped 1/5/10/25/every-50 mechanic, not a goal */}
            <View style={styles.milestoneBlock}>
              <View style={styles.milestoneHead}>
                <Text style={styles.milestoneLabel}>NEXT MILESTONE</Text>
                <Text style={styles.milestoneTarget}>
                  {milestoneNext} · {Math.max(0, milestoneNext - stats.uniqueSpecies)} TO GO
                </Text>
              </View>
              <View style={styles.milestoneTrack}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.milestoneSeg, i < litSegments && styles.milestoneSegLit]}
                  />
                ))}
                <Ionicons name="trophy" size={13} color={palette.sun} style={{ marginLeft: 4 }} />
              </View>
            </View>
          </View>
        </HardShadow>
      </View>

      <ClearableInput
        containerStyle={styles.searchBarWrap}
        style={styles.searchBar}
        placeholder="Search birds..."
        placeholderTextColor={palette.muted}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`Seen · ${stats.uniqueSpecies}`} active={filter === 'seen'} onPress={() => setFilter('seen')} />
        <Chip label={`Wishlist · ${wishlist.size}`} active={filter === 'wishlist'} onPress={() => setFilter('wishlist')} />
        <Chip label={`Region · ${regionsLabel}`} active={false} onPress={() => setRegionsModalOpen(true)} />
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={families}
        keyExtractor={keyExtractor}
        renderItem={renderFamily}
        ListHeaderComponent={header}
        windowSize={5}
        initialNumToRender={6}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <Text style={styles.attribution}>
            Bird names from the IOC World Bird List (v15.2) — worldbirdnames.org
          </Text>
        }
      />

      <Modal
        visible={regionsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRegionsModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRegionsModalOpen(false)}>
          <Pressable onPress={() => {}}>
            <HardShadow borderRadius={radius.card}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Regions</Text>
                  <Pressable
                    onPress={() => setRegionsModalOpen(false)}
                    style={styles.modalCloseButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={20} color={palette.ink} />
                  </Pressable>
                </View>
                <Text style={styles.modalSubtitle}>
                  Hide birds not from these regions. Birds you&apos;ve already logged stay visible regardless.
                </Text>

                <View style={styles.modalQuickRow}>
                  <Pressable
                    style={styles.quickButton}
                    onPress={() => persistRegions(ALL_REGIONS)}
                  >
                    <Text style={styles.quickButtonText}>Select all</Text>
                  </Pressable>
                  <Pressable
                    style={styles.quickButton}
                    onPress={() => persistRegions([])}
                  >
                    <Text style={styles.quickButtonText}>Clear</Text>
                  </Pressable>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {ALL_REGIONS.map(code => {
                    const on = selectedRegions.includes(code);
                    return (
                      <Pressable
                        key={code}
                        style={styles.regionRow}
                        onPress={() => toggleRegion(code)}
                      >
                        <View style={[styles.checkbox, on && styles.checkboxChecked]}>
                          {on && <Ionicons name="checkmark" size={14} color={palette.cream} />}
                        </View>
                        <Text style={styles.regionLabel}>{REGION_LABELS[code]}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </HardShadow>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Family region card ──────────────────────────────────────────────────────
const FamilyRegionCard = React.memo(function FamilyRegionCard({
  fam, open, stillOut, onToggle, onToggleWishlist, onPressSpecies,
}: {
  fam: FamView;
  open: boolean;
  stillOut: number;
  onToggle: (family: string) => void;
  onToggleWishlist: (name: string) => void;
  onPressSpecies: (name: string) => void;
}) {
  const pct = Math.round((fam.seen / Math.max(1, fam.total)) * 100);
  const rows: VisBird[][] = [];
  for (let i = 0; i < fam.birds.length; i += 2) rows.push(fam.birds.slice(i, i + 2));

  return (
    <View style={styles.familyWrap}>
      <HardShadow borderRadius={radius.card}>
        <View style={styles.familyCard}>
          <Pressable
            onPress={() => onToggle(fam.family)}
            style={styles.familyHeader}
            accessibilityRole="button"
          >
            <View style={styles.familyHeaderLeft}>
              <Ionicons
                name={open ? 'chevron-down' : 'chevron-forward'}
                size={15}
                color={palette.ink}
              />
              <Text style={styles.familyName} numberOfLines={1}>{fam.family}</Text>
            </View>
            <View style={styles.familyCountRow}>
              <Text style={styles.familySeen}>{fam.seen}</Text>
              <Text style={styles.familyTotal}>/{fam.total}</Text>
            </View>
          </Pressable>

          <View style={[styles.progressRow, open ? styles.progressRowOpen : styles.progressRowClosed]}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%` }]} />
            </View>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>

          {open && (
            <View style={styles.cardGrid}>
              {rows.map((row, ri) => (
                <View key={ri} style={styles.cardRow}>
                  {row.map((b) => (
                    <ACCard
                      key={b.name}
                      bird={b}
                      onToggleWishlist={onToggleWishlist}
                      onPressSpecies={onPressSpecies}
                    />
                  ))}
                  {row.length < 2 && <View style={styles.cardSlotSpacer} />}
                </View>
              ))}
            </View>
          )}

          {open && stillOut > 0 && (
            <Text style={styles.stillOut}>{stillOut} still out there</Text>
          )}
        </View>
      </HardShadow>
    </View>
  );
});

// ── Trading card ────────────────────────────────────────────────────────────
const ACCard = React.memo(function ACCard({
  bird, onToggleWishlist, onPressSpecies,
}: {
  bird: VisBird;
  onToggleWishlist: (name: string) => void;
  onPressSpecies: (name: string) => void;
}) {
  const { name, seen, times, photoUrl, globalFirst: first, wished, mystery, navigable, latin } = bird;
  const artHeight = 88; // full-height art for first too (no banner anymore)

  const art = !seen ? (
    <View style={[styles.art, styles.artUnseen, { height: artHeight }]}>
      <Text style={styles.artQ}>?</Text>
    </View>
  ) : photoUrl ? (
    <Image
      source={{ uri: photoUrl }}
      style={[styles.art, styles.artPhoto, { height: artHeight }]}
      resizeMode="cover"
    />
  ) : (
    <View style={[styles.art, { height: artHeight, backgroundColor: palette.leafSoft }]}>
      <Text style={styles.artInitial}>{name.charAt(0)}</Text>
    </View>
  );

  const body = (
    <>
      <View>
        {art}
        {first && (
          <View style={styles.globePill}>
            <HoloFill />
            <Ionicons name="globe-outline" size={9} color={palette.ink} />
            <Text style={styles.globePillText}>1ST</Text>
          </View>
        )}
      </View>

      {!mystery && (
        <Pressable
          onPress={() => onToggleWishlist(name)}
          style={[styles.starDisc, { top: 4 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={wished ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
        >
          <Ionicons
            name={wished ? 'star' : 'star-outline'}
            size={13}
            color={wished ? palette.sun : palette.muted}
          />
        </Pressable>
      )}

      <Text
        style={[styles.cardName, seen ? styles.cardNameSeen : styles.cardNameUnseen]}
        numberOfLines={2}
      >
        {name}
      </Text>
      {latin ? (
        <Text style={styles.cardLatin} numberOfLines={1}>{latin}</Text>
      ) : (
        <View style={styles.cardLatinSpacer} />
      )}

      <View style={styles.cardFooter}>
        {seen ? (
          <View style={styles.loggedPill}>
            <Text style={styles.loggedPillText}>LOGGED ×{times}</Text>
          </View>
        ) : (
          <Text style={styles.notYet}>NOT YET</Text>
        )}
      </View>
    </>
  );

  // Unseen ghost slots are flat (dashed border, cream stock — no shadow).
  if (!seen) {
    return (
      <Pressable
        style={[styles.card, styles.cardGhost]}
        onPress={navigable ? () => onPressSpecies(name) : undefined}
      >
        {body}
      </Pressable>
    );
  }

  // Global first: a normal white seen card wearing a holographic ring (just
  // outside the ink border) plus the globe "1ST" pill on the art. No gold.
  if (first) {
    return (
      <View style={styles.cardSlot}>
        <HardShadow offset={3} borderRadius={16} style={styles.cardFill}>
          <HoloRing radius={16}>
            <Pressable
              style={[styles.card, styles.cardSeen]}
              onPress={navigable ? () => onPressSpecies(name) : undefined}
            >
              {body}
            </Pressable>
          </HoloRing>
        </HardShadow>
      </View>
    );
  }

  // Plain seen card: raised, hard offset shadow.
  return (
    <View style={styles.cardSlot}>
      <HardShadow offset={3} borderRadius={14} style={styles.cardFill}>
        <Pressable
          style={[styles.card, styles.cardSeen]}
          onPress={navigable ? () => onPressSpecies(name) : undefined}
        >
          {body}
        </Pressable>
      </HardShadow>
    </View>
  );
});

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  headerSection: {
    paddingTop: space.lg,
  },
  title: {
    ...type.h1,
    color: palette.ink,
    fontWeight: '700',
    paddingHorizontal: space.xl,
    marginBottom: space.md,
  },

  // Stats hero
  heroWrap: {
    paddingHorizontal: space.xl,
    marginBottom: space.md,
  },
  hero: {
    backgroundColor: palette.ink,
    borderRadius: radius.card,
    padding: space.lg,
    ...border.thick,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
  },
  lifeCol: {
    alignItems: 'center',
  },
  lifeNumber: {
    fontFamily: font.displayBlack,
    fontSize: 44,
    color: palette.sun,
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  lifeLabel: {
    fontFamily: font.mono,
    fontSize: 9,
    color: palette.sun,
    opacity: 0.9,
    letterSpacing: 1,
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 78,
  },
  heroStats: {
    flex: 1,
    minWidth: 0,
  },
  heroStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  heroStatLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatLabel: {
    fontFamily: font.mono,
    fontSize: 9.5,
    color: palette.cream,
    opacity: 0.65,
    letterSpacing: 0.8,
  },
  heroStatSmall: {
    fontFamily: font.displayBlack,
    fontSize: 16,
    color: palette.cream,
    letterSpacing: -0.4,
  },
  heroStatDivider: {
    height: 1,
    backgroundColor: 'rgba(250, 246, 234, 0.18)',
  },

  // Milestone track
  milestoneBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(250, 246, 234, 0.18)',
  },
  milestoneHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  milestoneLabel: {
    fontFamily: font.mono,
    fontSize: 9,
    color: palette.cream,
    opacity: 0.6,
    letterSpacing: 1.2,
  },
  milestoneTarget: {
    fontFamily: font.monoBold,
    fontSize: 10,
    color: palette.sun,
    letterSpacing: 0.8,
  },
  milestoneTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  milestoneSeg: {
    flex: 1,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(250, 246, 234, 0.16)',
  },
  milestoneSegLit: {
    backgroundColor: palette.sun,
  },

  // Search
  searchBarWrap: {
    marginHorizontal: space.xl,
    marginBottom: space.md,
  },
  searchBar: {
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.lg,
    ...border.thick,
    fontFamily: font.body,
    fontSize: 15,
    color: palette.ink,
  },

  // Filter chips
  chipsRow: {
    paddingHorizontal: space.xl,
    gap: space.xs + 2,
    paddingBottom: space.md,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
    borderWidth: 1.5,
    borderColor: palette.ink,
  },
  chipActive: {
    backgroundColor: palette.ink,
  },
  chipText: {
    fontFamily: font.bodyBold,
    fontSize: 12,
    color: palette.ink,
  },
  chipTextActive: {
    color: palette.cream,
  },

  // List
  listContent: {
    paddingBottom: space.xl,
  },

  // Family region card
  familyWrap: {
    paddingHorizontal: space.xl,
    marginTop: space.md,
  },
  familyCard: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    padding: 14,
    ...border.thick,
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  familyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  familyName: {
    fontFamily: font.display,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: palette.ink,
    flexShrink: 1,
  },
  familyCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  familySeen: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    color: palette.ink,
    letterSpacing: -0.5,
  },
  familyTotal: {
    fontFamily: font.mono,
    fontSize: 12,
    color: palette.inkSoft,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressRowOpen: {
    marginTop: 8,
    marginBottom: 12,
  },
  progressRowClosed: {
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: palette.cream,
    borderWidth: 1.5,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.leaf,
  },
  progressPct: {
    fontFamily: font.monoBold,
    fontSize: 10,
    color: palette.inkSoft,
  },
  stillOut: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.inkSoft,
    textAlign: 'center',
    paddingTop: 12,
  },

  // Card grid
  cardGrid: {
    gap: 12,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  cardSlot: {
    flex: 1,
  },
  cardSlotSpacer: {
    flex: 1,
  },
  cardFill: {
    flex: 1,
  },

  // Trading card
  card: {
    borderRadius: 14,
    padding: 8,
  },
  cardSeen: {
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
  },
  cardGhost: {
    flex: 1,
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: 'rgba(26, 36, 23, 0.3)',
    borderStyle: 'dashed',
  },
  // Global-first globe "1ST" pill — holo fill, pinned to the art's top-left.
  globePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 6,
    paddingRight: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.ink,
    overflow: 'hidden',
  },
  globePillText: {
    fontFamily: font.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: palette.ink,
  },

  // Art area
  art: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artUnseen: {
    borderColor: 'rgba(26, 36, 23, 0.25)',
    borderStyle: 'dashed',
  },
  artPhoto: {
    borderColor: palette.ink,
  },
  artQ: {
    fontFamily: font.mono,
    fontSize: 26,
    color: palette.muted,
  },
  artInitial: {
    fontFamily: font.displayBlack,
    fontSize: 44,
    letterSpacing: -1,
    color: palette.ink,
    opacity: 0.85,
  },

  // Star disc
  starDisc: {
    position: 'absolute',
    right: 4,
    zIndex: 3,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
    borderWidth: 1.5,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card text
  cardName: {
    fontFamily: font.display,
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: -0.3,
    marginTop: 8,
    minHeight: 30,
  },
  cardNameSeen: {
    fontWeight: '700',
    color: palette.ink,
  },
  cardNameUnseen: {
    fontWeight: '600',
    color: palette.inkSoft,
  },
  cardLatin: {
    fontFamily: font.mono,
    fontStyle: 'italic',
    fontSize: 9,
    color: palette.muted,
    marginTop: 2,
  },
  cardLatinSpacer: {
    height: 11,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    minHeight: 16,
  },
  loggedPill: {
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  loggedPillText: {
    fontFamily: font.monoBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: palette.cream,
  },
  notYet: {
    fontFamily: font.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: palette.muted,
  },

  // Attribution
  attribution: {
    ...type.bodyS,
    color: palette.muted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: space.lg,
    marginHorizontal: space.xl,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 36, 23, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
  },
  modalSheet: {
    width: 320,
    maxWidth: '100%',
    ...recipes.card,
    padding: space.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  modalTitle: {
    ...type.h2,
    color: palette.ink,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginBottom: space.md,
    lineHeight: 16,
  },
  modalQuickRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  quickButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
    borderWidth: 1.5,
    borderColor: palette.ink,
  },
  quickButtonText: {
    fontFamily: font.bodyBold,
    fontSize: 12,
    color: palette.ink,
  },
  modalScroll: {
    maxHeight: 320,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: space.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: palette.leaf,
    borderColor: palette.ink,
  },
  regionLabel: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '500',
  },
});
