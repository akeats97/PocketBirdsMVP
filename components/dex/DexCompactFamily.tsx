import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, palette, radius, space } from '../../constants/Colors';
import { HoloFill } from '../Holo';

// One compact Dex family block: family name + seen/total, a leaf progress bar,
// then every species as a small wrapping chip. Shared by the Bird Dex tab's
// compact view (app/(tabs)/dex.tsx) and the profile Bird Dex tab
// (components/profile/ProfileView.tsx) so both surfaces read identically.

export interface CompactSpecies {
  name: string;
  seen: boolean;
  count: number;       // times logged
  globalFirst: boolean; // first on Pocket Birds (verified)
}

function Chip({ sp }: { sp: CompactSpecies }) {
  // Global-first (seen): holographic shimmer behind a transparent chip + a globe
  // glyph. The holo lives behind the content (absolute-fill first child, parent
  // clips with overflow:hidden) — mirrors the grid view's "1ST" pill.
  if (sp.seen && sp.globalFirst) {
    return (
      <View style={[styles.chip, styles.chipFirst]}>
        <HoloFill />
        <Ionicons name="globe-outline" size={9} color={palette.ink} />
        <Text style={styles.chipText}>{sp.name}</Text>
        {sp.count > 1 && <Text style={styles.chipCount}>×{sp.count}</Text>}
      </View>
    );
  }

  const unseen = !sp.seen;
  return (
    <View style={[styles.chip, unseen ? styles.chipUnseen : styles.chipSeen]}>
      <Text style={[styles.chipText, unseen && styles.chipTextUnseen]}>{sp.name}</Text>
      {sp.count > 1 && <Text style={styles.chipCount}>×{sp.count}</Text>}
    </View>
  );
}

export function DexCompactFamily({
  family, seen, total, species,
}: {
  family: string;
  seen: number;
  total: number;
  species: CompactSpecies[];
}) {
  const pct = Math.min(100, (seen / Math.max(1, total)) * 100);
  return (
    <View style={styles.family}>
      <View style={styles.header}>
        <Text style={styles.name}>{family}</Text>
        <Text style={styles.count}>{seen}/{total}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.chips}>
        {species.map(sp => (
          <Chip key={sp.name} sp={sp} />
        ))}
      </View>
    </View>
  );
}

export default DexCompactFamily;

const styles = StyleSheet.create({
  family: { paddingHorizontal: space.xl, marginBottom: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontFamily: font.display, fontSize: 14, fontWeight: '700', color: palette.ink, letterSpacing: -0.3 },
  count: { fontFamily: font.mono, fontSize: 10, color: palette.inkSoft },
  barTrack: {
    height: 8,
    backgroundColor: palette.card,
    borderWidth: 1.5,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: { height: '100%', backgroundColor: palette.leaf },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.chip,
    borderWidth: 1.5,
  },
  chipSeen: { borderColor: palette.ink, backgroundColor: palette.leafSoft },
  chipUnseen: { borderColor: palette.muted, backgroundColor: 'transparent', opacity: 0.6 },
  chipFirst: { borderColor: palette.ink, backgroundColor: 'transparent', position: 'relative', overflow: 'hidden' },
  chipText: { fontFamily: font.body, fontSize: 11, fontWeight: '600', color: palette.ink },
  chipTextUnseen: { color: palette.inkSoft },
  chipCount: { fontFamily: font.mono, fontSize: 9, color: palette.inkSoft },
});
