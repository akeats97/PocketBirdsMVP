import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { birdFamilies, REGION_CODES, REGION_LABELS, RegionCode } from '../../constants/birdNames';
import { useSightings } from '../context/SightingsContext';

type SeenInfo = { timesSeen: number; lastSeen: string };
type RowItem = string[]; // up to COLUMNS bird names per row
type Section = { title: string; data: RowItem[] };

const COLUMNS = 3;
const REGIONS_STORAGE_KEY = 'dex.selectedRegions.v1';
const ALL_REGIONS: RegionCode[] = [...REGION_CODES];

export default function DexScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlySeen, setShowOnlySeen] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState<RegionCode[]>(ALL_REGIONS);
  const [regionsModalOpen, setRegionsModalOpen] = useState(false);
  const { sightings } = useSightings();

  // Load persisted region filter on mount.
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

  // Build a name → SeenInfo map from sightings (recomputed when sightings change).
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

  // Build section data: one section per family, rows of up to COLUMNS birds.
  // A species is included if any of its regions is selected, OR the user has
  // seen it (never hide a sighting), OR it has no region data (avoid hiding
  // species due to missing IOC metadata).
  const sections = useMemo<Section[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const selSet = new Set(selectedRegions);
    const out: Section[] = [];
    const canonical = new Set<string>();

    const passesRegion = (regions: RegionCode[], seen: boolean) =>
      seen || regions.length === 0 || regions.some(r => selSet.has(r));

    for (const fam of birdFamilies) {
      const filtered: string[] = [];
      for (const b of fam.birds) {
        canonical.add(b.name);
        const seen = !!seenMap[b.name];
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
      out.push({ title: fam.family, data: rows });
    }

    // Sightings logged under names not in the canonical list — never hidden.
    const orphans = Object.keys(seenMap)
      .filter(name => !canonical.has(name))
      .filter(name => !q || name.toLowerCase().includes(q));
    if (orphans.length) {
      const rows: RowItem[] = [];
      for (let i = 0; i < orphans.length; i += COLUMNS) {
        rows.push(orphans.slice(i, i + COLUMNS));
      }
      out.push({ title: 'Other', data: rows });
    }

    return out;
  }, [searchQuery, showOnlySeen, seenMap, selectedRegions]);

  const regionsLabel =
    selectedRegions.length === ALL_REGIONS.length
      ? 'All regions'
      : selectedRegions.length === 0
        ? 'No regions'
        : `${selectedRegions.length} region${selectedRegions.length === 1 ? '' : 's'}`;

  const renderRow = ({ item }: { item: RowItem }) => (
    <View style={styles.row}>
      {item.map(name => {
        const seen = !!seenMap[name];
        return (
          <View key={name} style={[styles.card, seen && styles.cardSeen]}>
            <Text
              style={[styles.birdName, seen && styles.birdNameSeen]}
              numberOfLines={3}
            >
              {name}
            </Text>
          </View>
        );
      })}
      {item.length < COLUMNS &&
        Array.from({ length: COLUMNS - item.length }).map((_, i) => (
          <View key={`spacer-${i}`} style={styles.cardSpacer} />
        ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bird Dex</Text>

      <View style={styles.statsPanel}>
        <View style={styles.statItem}>
          <FontAwesome5 name="eye" size={18} color="#4CAF50" style={styles.statIcon} />
          <View>
            <Text style={styles.statValue}>{stats.totalSightings}</Text>
            <Text style={styles.statLabel}>Total Sightings</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.statItem}>
          <FontAwesome5 name="feather" size={18} color="#2196F3" style={styles.statIcon} />
          <View>
            <Text style={styles.statValue}>{stats.uniqueSpecies}</Text>
            <Text style={styles.statLabel}>Species Seen</Text>
          </View>
        </View>
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="Search birds..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.toggleContainer}
          onPress={() => setShowOnlySeen(!showOnlySeen)}
        >
          <View style={[styles.checkbox, showOnlySeen && styles.checkboxChecked]}>
            {showOnlySeen && <FontAwesome5 name="check" size={12} color="white" />}
          </View>
          <Text style={styles.toggleText}>Show only seen birds</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.regionsButton}
          onPress={() => setRegionsModalOpen(true)}
          accessibilityLabel="Region filter"
        >
          <Ionicons name="earth-outline" size={16} color="#444" />
          <Text style={styles.regionsButtonText}>{regionsLabel}</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => item.join('|') + idx}
        renderItem={renderRow}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        stickySectionHeadersEnabled
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
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Regions</Text>
              <TouchableOpacity onPress={() => setRegionsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Hide birds not from these regions. Birds you've already logged stay visible regardless.
            </Text>

            <View style={styles.modalQuickRow}>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => persistRegions(ALL_REGIONS)}
              >
                <Text style={styles.quickButtonText}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => persistRegions([])}
              >
                <Text style={styles.quickButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {ALL_REGIONS.map(code => {
              const on = selectedRegions.includes(code);
              return (
                <TouchableOpacity
                  key={code}
                  style={styles.regionRow}
                  onPress={() => toggleRegion(code)}
                >
                  <View style={[styles.checkbox, on && styles.checkboxChecked]}>
                    {on && <FontAwesome5 name="check" size={12} color="white" />}
                  </View>
                  <Text style={styles.regionLabel}>{REGION_LABELS[code]}</Text>
                </TouchableOpacity>
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
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  statsPanel: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: '#ddd',
  },
  searchBar: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 14,
  },
  regionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  regionsButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  card: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    minHeight: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSeen: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  cardSpacer: {
    flex: 1,
  },
  birdName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#999',
    textAlign: 'center',
  },
  birdNameSeen: {
    color: '#1B5E20',
    fontWeight: '600',
  },
  attribution: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalSheet: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    lineHeight: 16,
  },
  modalQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
  },
  quickButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  regionLabel: {
    fontSize: 15,
    color: '#222',
  },
});
