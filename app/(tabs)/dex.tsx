import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { HardShadow } from '../../components/SightingCard';
import { birdFamilies, REGION_CODES, REGION_LABELS, RegionCode } from '../../constants/birdNames';
import { border, font, palette, radius, recipes, space, type } from '../../constants/Colors';
import { useSightings } from '../context/SightingsContext';

type SeenInfo = { timesSeen: number; lastSeen: string };
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
  const [showOnlySeen, setShowOnlySeen] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState<RegionCode[]>(ALL_REGIONS);
  const [regionsModalOpen, setRegionsModalOpen] = useState(false);
  const { sightings } = useSightings();

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

  const seenMap = useMemo(() => {
    const map: { [name: string]: SeenInfo } = {};
    sightings.forEach(s => {
      const entry = map[s.birdName] || { timesSeen: 0, lastSeen: '' };
      entry.timesSeen += 1;
      const d = s.date.toISOString().split('T')[0];
      if (!entry.lastSeen || d > entry.lastSeen) entry.lastSeen = d;
      map[s.birdName] = entry;
    });
    return map;
  }, [sightings]);

  const stats = useMemo(() => ({
    totalSightings: sightings.length,
    uniqueSpecies: Object.keys(seenMap).length,
  }), [sightings.length, seenMap]);

  const sections = useMemo<Section[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const selSet = new Set(selectedRegions);
    const out: Section[] = [];
    const canonical = new Set<string>();

    const passesRegion = (regions: RegionCode[], seen: boolean) =>
      seen || regions.length === 0 || regions.some(r => selSet.has(r));

    for (const fam of birdFamilies) {
      const filtered: string[] = [];
      let familySeen = 0;
      for (const b of fam.birds) {
        canonical.add(b.name);
        const seen = !!seenMap[b.name];
        if (seen) familySeen += 1;
        if (showOnlySeen && !seen) continue;
        if (!passesRegion(b.regions, seen)) continue;
        if (q && !b.name.toLowerCase().includes(q)) continue;
        filtered.push(b.name);
      }
      if (filtered.length === 0) continue;
      const rows: RowItem[] = [];
      for (let i = 0; i < filtered.length; i += COLUMNS) {
        rows.push(filtered.slice(i, i + COLUMNS));
      }
      out.push({ title: fam.family, data: rows, familySeen, familyTotal: fam.birds.length });
    }

    const orphans = Object.keys(seenMap)
      .filter(name => !canonical.has(name))
      .filter(name => !q || name.toLowerCase().includes(q));
    if (orphans.length) {
      const rows: RowItem[] = [];
      for (let i = 0; i < orphans.length; i += COLUMNS) {
        rows.push(orphans.slice(i, i + COLUMNS));
      }
      out.push({ title: 'Other', data: rows, familySeen: orphans.length, familyTotal: orphans.length });
    }

    return out;
  }, [searchQuery, showOnlySeen, seenMap, selectedRegions]);

  const regionsLabel =
    selectedRegions.length === ALL_REGIONS.length
      ? 'All regions'
      : selectedRegions.length === 0
        ? 'No regions'
        : `${selectedRegions.length} region${selectedRegions.length === 1 ? '' : 's'}`;

  const renderRow = useCallback(({ item }: { item: RowItem }) => (
    <View style={styles.row}>
      {item.map(name => {
        const info = seenMap[name];
        const seen = !!info;
        const times = info?.timesSeen ?? 0;
        return (
          <View key={name} style={[styles.tile, seen ? styles.tileSeen : styles.tileUnseen]}>
            <Text
              style={[styles.tileName, seen ? styles.tileNameSeen : styles.tileNameUnseen]}
              numberOfLines={3}
            >
              {name}
            </Text>
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
  ), [seenMap]);

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
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeNumber}>{stats.uniqueSpecies}</Text>
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroLabel}>YOUR LIFE LIST</Text>
                <Text style={styles.heroValue}>
                  {stats.uniqueSpecies} {stats.uniqueSpecies === 1 ? 'species' : 'species'}
                </Text>
                <Text style={styles.heroSubtitle}>
                  Next milestone: {nextMilestone(stats.uniqueSpecies)} — keep going.
                </Text>
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
          <Chip label="All" active={!showOnlySeen} onPress={() => setShowOnlySeen(false)} />
          <Chip label="Seen" active={showOnlySeen} onPress={() => setShowOnlySeen(true)} />
          <Chip label={`Region · ${regionsLabel}`} active={false} onPress={() => setRegionsModalOpen(true)} />
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        removeClippedSubviews
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    ...border.thick,
  },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.sun,
    borderWidth: 2,
    borderColor: palette.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeNumber: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    color: palette.ink,
    letterSpacing: -0.5,
  },
  heroText: {
    flex: 1,
  },
  heroLabel: {
    ...type.label,
    color: palette.cream,
    opacity: 0.65,
  },
  heroValue: {
    ...type.h2,
    color: palette.cream,
    fontWeight: '700',
    marginTop: 2,
  },
  heroSubtitle: {
    ...type.bodyS,
    color: palette.cream,
    opacity: 0.7,
    marginTop: 4,
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
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: space.lg + 2,
    marginTop: space.sm,
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
    paddingRight: 4,
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
