import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { HardShadow } from '../../components/SightingCard';
import { birdFamilies, REGION_CODES, REGION_LABELS, RegionCode } from '../../constants/birdNames';
import { border, font, palette, radius, recipes, space, type } from '../../constants/Colors';
import { isReportEntry } from '../../constants/reportTypes';
import { isUnknownEntry } from '../../constants/unknownBird';
import { isCustomSpecies } from '../../constants/customSpecies';
import { useSightings } from '../context/SightingsContext';
import { useWishlist } from '../context/WishlistContext';

type FilterMode = 'all' | 'seen' | 'wishlist';

type SeenInfo = { timesSeen: number; lastSeen: string; hasPhoto: boolean; isGlobalFirst: boolean };
type RowItem = string[];
type Section = { title: string; data: RowItem[]; familySeen: number; familyTotal: number };

const COLUMNS = 3;
const TOTAL_SPECIES = 11227; // IOC v15.2
const REGIONS_STORAGE_KEY = 'dex.selectedRegions.v1';
const ALL_REGIONS: RegionCode[] = [...REGION_CODES];

function nextMilestone(count: number): number {
  if (count < 5) return 5;
  if (count < 10) return 10;
  if (count < 25) return 25;
  if (count < 50) return 50;
  return Math.ceil((count + 1) / 50) * 50;
}

export default function DexScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('seen');
  const [selectedRegions, setSelectedRegions] = useState<RegionCode[]>(ALL_REGIONS);
  const [regionsModalOpen, setRegionsModalOpen] = useState(false);
  const { sightings } = useSightings();
  const { wishlist, toggle: toggleWishlist } = useWishlist();

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

  // Exclude Bug Report / Feature Request entries — they aren't real species
  // and shouldn't appear in the Dex or its stats.
  const realSightings = useMemo(
    () => sightings.filter(s => !isReportEntry(s.birdName)),
    [sightings]
  );

  const seenMap = useMemo(() => {
    const map: { [name: string]: SeenInfo } = {};
    realSightings.forEach(s => {
      // "Mystery Bird" entries are real sightings (they count in the sightings
      // total above) but have no identified species, so they never get a Dex
      // tile or feed into the species / photographed counts.
      if (isUnknownEntry(s.birdName)) return;
      const entry = map[s.birdName] || { timesSeen: 0, lastSeen: '', hasPhoto: false, isGlobalFirst: false };
      entry.timesSeen += 1;
      const d = s.date.toISOString().split('T')[0];
      if (!entry.lastSeen || d > entry.lastSeen) entry.lastSeen = d;
      if (s.photoUrl) entry.hasPhoto = true;
      if (s.globalFirst) entry.isGlobalFirst = true;
      map[s.birdName] = entry;
    });
    return map;
  }, [realSightings]);

  // Custom easter-egg species (e.g. Kelsey) get a Dex tile (via the orphan
  // "Other" path below) but are kept out of the headline species counts.
  const stats = useMemo(() => {
    const realSpeciesNames = Object.keys(seenMap).filter(n => !isCustomSpecies(n));
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

  const sections = useMemo<Section[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const selSet = new Set(selectedRegions);
    const out: Section[] = [];
    const canonical = new Set<string>();

    // A bird's intrinsic regional fit (independent of whether the user has
    // seen it). Used for the section header count so the denominator tracks
    // the selected regions instead of the global species total.
    const inRegion = (regions: RegionCode[]) =>
      regions.length === 0 || regions.some(r => selSet.has(r));

    const passesRegion = (regions: RegionCode[], seen: boolean) =>
      seen || inRegion(regions);

    for (const fam of birdFamilies) {
      const filtered: string[] = [];
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
        // 'all' shows the region-scoped set; 'seen'/'wishlist' don't need the
        // region-pass check because seen and wishlisted birds are always
        // visible regardless of region selection.
        if (filter === 'all' && !passesRegion(b.regions, seen || wished)) continue;
        if (q && !b.name.toLowerCase().includes(q)) continue;
        filtered.push(b.name);
      }
      if (filtered.length === 0) continue;
      const rows: RowItem[] = [];
      for (let i = 0; i < filtered.length; i += COLUMNS) {
        rows.push(filtered.slice(i, i + COLUMNS));
      }
      out.push({ title: fam.family, data: rows, familySeen, familyTotal });
    }

    // Orphan names: anything in the user's seen map OR wishlist that isn't in
    // the canonical IOC list. Show them under "Other" if they pass the active
    // filter.
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
      .sort();

    if (orphans.length) {
      const rows: RowItem[] = [];
      for (let i = 0; i < orphans.length; i += COLUMNS) {
        rows.push(orphans.slice(i, i + COLUMNS));
      }
      out.push({ title: 'Other', data: rows, familySeen: orphans.length, familyTotal: orphans.length });
    }

    return out;
  }, [searchQuery, filter, seenMap, selectedRegions, wishlist]);

  const regionsLabel =
    selectedRegions.length === ALL_REGIONS.length
      ? 'All regions'
      : selectedRegions.length === 0
        ? 'No regions'
        : `${selectedRegions.length} region${selectedRegions.length === 1 ? '' : 's'}`;

  const renderRow = useCallback(({ item }: { item: RowItem }) => (
    <View style={styles.row}>
      {item.map((name) => {
        const info = seenMap[name];
        const seen = !!info;
        const times = info?.timesSeen ?? 0;
        const hasPhoto = info?.hasPhoto ?? false;
        const globalFirst = info?.isGlobalFirst ?? false;
        const wished = wishlist.has(name);
        return (
          <View
            key={name}
            style={[styles.tile, seen ? styles.tileSeen : styles.tileUnseen]}
          >
            {globalFirst ? (
              // Global first: green "seen" tile + a gold trophy marking that
              // this user was the first on PocketBirds to log the species.
              <View style={styles.tileNameRow}>
                <Ionicons name="trophy" size={11} color={palette.sun} style={styles.tileTrophy} />
                <Text style={[styles.tileName, styles.tileNameSeen, styles.tileNameFlex]} numberOfLines={3}>
                  {name}
                </Text>
              </View>
            ) : (
              <Text
                style={[styles.tileName, seen ? styles.tileNameSeen : styles.tileNameUnseen]}
                numberOfLines={3}
              >
                {name}
              </Text>
            )}
            <Pressable
              onPress={() => toggleWishlist(name)}
              style={styles.starButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={wished ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
            >
              <Ionicons
                name={wished ? 'star' : 'star-outline'}
                size={18}
                color={wished ? palette.sun : palette.muted}
              />
            </Pressable>
            {hasPhoto && (
              <View style={styles.cameraIndicator}>
                <Ionicons name="camera" size={14} color={palette.sun} />
              </View>
            )}
            {seen && times > 1 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>×{times}</Text>
              </View>
            )}
          </View>
        );
      })}
      {item.length < COLUMNS &&
        Array.from({ length: COLUMNS - item.length }).map((_, i) => (
          <View key={`spacer-${i}`} style={styles.tileSpacer} />
        ))}
    </View>
  ), [seenMap, wishlist, toggleWishlist]);

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
      <Text style={styles.sectionHeaderCount}>
        {section.familySeen}/{section.familyTotal}
      </Text>
    </View>
  ), []);

  const keyExtractor = useCallback((item: RowItem) => item[0], []);

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Bird Dex</Text>

        <View style={styles.heroWrap}>
          <HardShadow borderRadius={radius.card}>
            <View style={styles.hero}>
              <View style={styles.statsRow}>
                <View style={styles.statBlock}>
                  <View style={styles.statCircle}>
                    <Text style={styles.statCircleNumber}>{stats.uniqueSpecies}</Text>
                  </View>
                  <Text style={styles.statLabel}>species</Text>
                </View>
                <View style={styles.statBlock}>
                  <View style={styles.statCircle}>
                    <Text style={styles.statCircleNumber}>{stats.totalSightings}</Text>
                  </View>
                  <Text style={styles.statLabel}>sightings</Text>
                </View>
                <View style={styles.statBlock}>
                  <View style={styles.statCircle}>
                    <Text style={styles.statCircleNumber}>{stats.photographedSpecies}</Text>
                  </View>
                  <View style={styles.statLabelRow}>
                    <Ionicons name="camera" size={11} color={palette.cream} style={{ marginRight: 3, opacity: 0.7 }} />
                    <Text style={styles.statLabel}>photographed</Text>
                  </View>
                </View>
              </View>
            </View>
          </HardShadow>
        </View>

        <TextInput
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
          <Chip label="Seen" active={filter === 'seen'} onPress={() => setFilter('seen')} />
          <Chip label="Wishlist" active={filter === 'wishlist'} onPress={() => setFilter('wishlist')} />
          <Chip label={`Region · ${regionsLabel}`} active={false} onPress={() => setRegionsModalOpen(true)} />
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        windowSize={5}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.sun,
    borderWidth: 2,
    borderColor: palette.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statCircleNumber: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    color: palette.ink,
    letterSpacing: -0.5,
  },
  statLabel: {
    ...type.bodyS,
    color: palette.cream,
    opacity: 0.7,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Search
  searchBar: {
    marginHorizontal: space.xl,
    marginBottom: space.md,
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

  // List + section
  listContent: {
    paddingBottom: space.xl,
  },
  sectionHeader: {
    backgroundColor: palette.cream,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: palette.ink,
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: space.lg + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: palette.ink,
  },
  sectionHeaderCount: {
    fontFamily: font.mono,
    fontSize: 10,
    color: palette.inkSoft,
  },

  // Tile grid
  row: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  tile: {
    flex: 1,
    borderRadius: 10,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 7,
    borderWidth: 2,
    borderColor: palette.ink,
    minHeight: 82,
    justifyContent: 'space-between',
  },
  tileSeen: {
    backgroundColor: palette.leafSoft,
  },
  tileUnseen: {
    backgroundColor: palette.card,
    opacity: 0.78,
  },
  tileSpacer: {
    flex: 1,
  },
  tileName: {
    fontFamily: font.display,
    fontSize: 12,
    lineHeight: 13.2,
    letterSpacing: -0.3,
    paddingRight: 22,
  },
  // Global-first tiles render the name in a row beside a small gold trophy.
  tileNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 22,
  },
  tileTrophy: {
    marginRight: 3,
    marginTop: 1,
  },
  tileNameFlex: {
    flex: 1,
    paddingRight: 0,
  },
  starButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileNameSeen: {
    fontWeight: '700',
    color: palette.ink,
  },
  tileNameUnseen: {
    fontWeight: '600',
    color: palette.inkSoft,
  },
  countBadge: {
    alignSelf: 'flex-end',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 4,
  },
  countBadgeText: {
    fontFamily: font.monoBold,
    fontSize: 9,
    color: palette.cream,
    letterSpacing: 0.3,
  },
  cameraIndicator: {
    position: 'absolute',
    bottom: 5,
    left: 6,
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
