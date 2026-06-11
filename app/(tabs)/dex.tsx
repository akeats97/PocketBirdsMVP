import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import ClearableInput from '../../components/ClearableInput';
import { ProgressRing } from '../../components/dex/ProgressRing';
import { HardShadow } from '../../components/SightingCard';
import { birdFamilies, REGION_CODES, REGION_LABELS, RegionCode } from '../../constants/birdNames';
import { border, font, palette, radius, recipes, space, type } from '../../constants/Colors';
import { isReportEntry } from '../../constants/reportTypes';
import { isUnknownEntry } from '../../constants/unknownBird';
import { isCustomSpecies } from '../../constants/customSpecies';
import { useSightings } from '../context/SightingsContext';
import { useWishlist } from '../context/WishlistContext';
import { isActiveGoal, useDexGoal } from '../services/goalService';

const GOAL_PRESETS = [25, 50, 100, 200];

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

  // Exclude Bug Report / Feature Request entries — they aren't real species
  // and shouldn't appear in the Dex or its stats.
  const realSightings = useMemo(
    () => sightings.filter(s => !isReportEntry(s.birdName)),
    [sightings]
  );

  const seenMap = useMemo(() => {
    const map: { [name: string]: SeenInfo } = {};
    realSightings.forEach(s => {
      // "Mystery Bird" entries DO get a tile (under "Other") showing how many
      // you've logged, but they're kept out of the species headline count (see
      // `stats` below) since they have no identified species.
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

  // Distinct countable species observed this calendar year — what the goal
  // ring fills with.
  const speciesThisYear = useMemo(() => {
    const year = new Date().getFullYear();
    return new Set(
      realSightings
        .filter(s => s.date.getFullYear() === year && !isCustomSpecies(s.birdName) && !isUnknownEntry(s.birdName))
        .map(s => s.birdName.toLowerCase())
    ).size;
  }, [realSightings]);

  const { goal, saveGoal } = useDexGoal();
  const goalActive = isActiveGoal(goal);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const openGoalSheet = () => {
    setGoalInput(goalActive ? String(goal.target) : '');
    setGoalSheetOpen(true);
  };

  const goalInputNum = parseInt(goalInput, 10);
  const goalInputValid = Number.isFinite(goalInputNum) && goalInputNum > 0;

  const handleSaveGoal = () => {
    if (!goalInputValid) return;
    saveGoal(goalInputNum);
    setGoalSheetOpen(false);
  };

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
        // Mystery Bird gets a tile (count of how many you've logged) but can't be
        // wishlisted — there's no species to wish for.
        const isMystery = isUnknownEntry(name);
        // Every real species tile opens its Species Detail screen. Mystery Bird
        // and custom easter-egg species (e.g. Kelsey) have no species page.
        const navigable = !isMystery && !isCustomSpecies(name);
        return (
          <Pressable
            key={name}
            onPress={navigable ? () => router.push({ pathname: '/species/[name]', params: { name } }) : undefined}
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
            {!isMystery && (
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
            )}
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
          </Pressable>
        );
      })}
      {item.length < COLUMNS &&
        Array.from({ length: COLUMNS - item.length }).map((_, i) => (
          <View key={`spacer-${i}`} style={styles.tileSpacer} />
        ))}
    </View>
  ), [seenMap, wishlist, toggleWishlist, router]);

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
        <Text style={styles.sectionHeaderCount}>
          {section.familySeen}/{section.familyTotal}
        </Text>
      </View>
      <View style={styles.dexBarTrack}>
        <View
          style={[
            styles.dexBarFill,
            { width: `${Math.min(100, (section.familySeen / Math.max(1, section.familyTotal)) * 100)}%` },
          ]}
        />
      </View>
    </View>
  ), []);

  const keyExtractor = useCallback((item: RowItem) => item[0], []);

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Bird Dex</Text>

        <View style={styles.heroWrap}>
          <HardShadow borderRadius={radius.card}>
            {/* Tap anywhere on the hero to set / edit the annual goal */}
            <Pressable style={styles.hero} onPress={openGoalSheet}>
              <View style={styles.heroRow}>
                {/* Goal ring — this year's species, filling toward the goal */}
                <View style={styles.ringCol}>
                  <ProgressRing
                    progress={goalActive ? speciesThisYear / goal.target : 1}
                    center={speciesThisYear}
                  />
                  <Text style={styles.ringSub}>
                    {goalActive
                      ? `of ${goal.target} this year`
                      : `set a ${new Date().getFullYear()} goal`}
                  </Text>
                </View>

                {/* All-time stats — species leads, the others support */}
                <View style={styles.heroStats}>
                  <View style={styles.heroStatRow}>
                    <Text style={styles.heroStatLabel}>SPECIES</Text>
                    <Text style={styles.heroStatBig}>{stats.uniqueSpecies}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStatRow}>
                    <Text style={styles.heroStatLabel}>SIGHTINGS</Text>
                    <Text style={styles.heroStatSmall}>{stats.totalSightings}</Text>
                  </View>
                  <View style={styles.heroStatRow}>
                    <View style={styles.heroStatLabelRow}>
                      <Ionicons name="camera" size={10} color={palette.sun} style={{ marginRight: 4 }} />
                      <Text style={styles.heroStatLabel}>PHOTOGRAPHED</Text>
                    </View>
                    <Text style={styles.heroStatSmall}>{stats.photographedSpecies}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
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

      {/* Annual goal sheet — set or edit the species goal the ring fills toward */}
      <BottomSheet visible={goalSheetOpen} onClose={() => setGoalSheetOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.goalSheet}>
            <Text style={styles.goalTitle}>Your {new Date().getFullYear()} species goal</Text>
            <Text style={styles.goalSub}>
              Pick a number that scares you a little. You can change it anytime, no judgment.
            </Text>

            <View style={styles.goalPresetsRow}>
              {GOAL_PRESETS.map((n) => {
                const active = goalInput === String(n);
                return (
                  <Pressable
                    key={n}
                    style={[styles.goalPreset, active && styles.goalPresetActive]}
                    onPress={() => setGoalInput(String(n))}
                  >
                    <Text style={[styles.goalPresetText, active && styles.goalPresetTextActive]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={styles.goalInput}
              value={goalInput}
              onChangeText={(t) => setGoalInput(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="or type your own"
              placeholderTextColor={palette.muted}
              maxLength={5}
            />

            <HardShadow offset={3} borderRadius={radius.input}>
              <Pressable
                style={[styles.goalSaveButton, !goalInputValid && styles.goalSaveDisabled]}
                onPress={handleSaveGoal}
                disabled={!goalInputValid}
              >
                <Text style={[styles.goalSaveText, !goalInputValid && { color: palette.inkSoft }]}>
                  {goalInputValid ? `Chase ${goalInputNum} species` : 'Set a goal'}
                </Text>
              </Pressable>
            </HardShadow>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
  },
  ringCol: {
    alignItems: 'center',
  },
  ringSub: {
    ...type.bodyS,
    color: palette.cream,
    opacity: 0.7,
    marginTop: 6,
    textAlign: 'center',
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
  heroStatBig: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    color: palette.sun,
    letterSpacing: -0.6,
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
    marginVertical: 2,
  },

  // Goal sheet
  goalSheet: {
    backgroundColor: palette.cream,
    borderTopWidth: 2,
    borderColor: palette.ink,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  goalTitle: {
    ...type.h2,
    color: palette.ink,
  },
  goalSub: {
    ...type.body,
    color: palette.inkSoft,
    marginTop: 4,
    marginBottom: space.lg,
  },
  goalPresetsRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  goalPreset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.input,
    backgroundColor: palette.card,
    ...border.thick,
  },
  goalPresetActive: {
    backgroundColor: palette.sun,
  },
  goalPresetText: {
    fontFamily: font.display,
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink,
  },
  goalPresetTextActive: {
    color: palette.ink,
  },
  goalInput: {
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.lg,
    ...border.thick,
    fontFamily: font.body,
    fontSize: 15,
    color: palette.ink,
    marginBottom: space.lg,
  },
  goalSaveButton: {
    backgroundColor: palette.leaf,
    paddingVertical: space.md,
    borderRadius: radius.input,
    ...border.thick,
    alignItems: 'center',
  },
  goalSaveDisabled: {
    backgroundColor: palette.card,
  },
  goalSaveText: {
    fontFamily: font.display,
    fontWeight: '700',
    fontSize: 15,
    color: '#fff',
    letterSpacing: -0.3,
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
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dexBarTrack: {
    height: 8,
    backgroundColor: palette.card,
    borderWidth: 1.5,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  dexBarFill: {
    height: '100%',
    backgroundColor: palette.leaf,
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
