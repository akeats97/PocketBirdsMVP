import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sighting } from '../../app/types';
import { compareLists } from '../../app/utils/compareLists';
import { font, palette, radius, space } from '../../constants/Colors';
import { HardShadow } from '../SightingCard';

interface CompareCardProps {
  me: Sighting[];
  them: Sighting[];
  name: string;
  onPress: () => void;
}

// Small dot used in the legend: 8px circle, 1px ink border.
function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

// The comparison module that sits on a friend's profile between the stat strip
// and the segmented tabs. Tapping anywhere opens the full Venn compare screen.
export default function CompareCard({ me, them, name, onPress }: CompareCardProps) {
  const c = useMemo(() => compareLists(me, them), [me, them]);
  const union = c.union || 1; // avoid 0-width divide; bar collapses to nothing at 0
  const pct = (v: number): DimensionValue => `${(v / union) * 100}%`;

  return (
    <HardShadow offset={4} borderRadius={radius.card}>
      <Pressable
        style={styles.card}
        onPress={onPress}
        android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
      >
        {/* Header: overlap headline + in-common count */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.eyebrow}>YOU &amp; {name.toUpperCase()}</Text>
            <View style={styles.overlapRow}>
              <Text style={styles.overlapPct}>{c.overlap}%</Text>
              <Text style={styles.overlapLabel}>lists overlap</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.sharedNum}>{c.shared}</Text>
            <Text style={styles.sharedLabel}>in common</Text>
          </View>
        </View>

        {/* Tri-split bar: only you (sky) · shared (sun) · only them (coral) */}
        <View style={styles.barWrap}>
          <View style={styles.bar}>
            <View style={[styles.barSeg, { width: pct(c.onlyYou), backgroundColor: palette.sky }]} />
            <View style={[styles.barSeg, { width: pct(c.shared), backgroundColor: palette.sun }]} />
            <View style={[styles.barSeg, { width: pct(c.onlyThem), backgroundColor: palette.coral }]} />
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <Dot color={palette.sky} />
              <Text style={styles.legendText}>{c.onlyYou} you</Text>
            </View>
            <View style={styles.legendItem}>
              <Dot color={palette.sun} />
              <Text style={styles.legendText}>{c.shared} shared</Text>
            </View>
            <View style={styles.legendItem}>
              <Dot color={palette.coral} />
              <Text style={styles.legendText} numberOfLines={1}>{c.onlyThem} {name}</Text>
            </View>
          </View>
        </View>

        {/* Footer: the chase, made explicit */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            See the {c.onlyThem} {c.onlyThem === 1 ? 'bird' : 'birds'} that <Text style={styles.footerStrong}>{name}</Text> has that you don&apos;t
          </Text>
          <Ionicons name="arrow-forward" size={16} color={palette.coral} />
        </View>
      </Pressable>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: palette.ink,
    overflow: 'hidden',
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    paddingHorizontal: space.lg,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: font.mono,
    fontSize: 9.5,
    color: palette.inkSoft,
    letterSpacing: 1,
  },
  overlapRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  overlapPct: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    color: palette.ink,
    letterSpacing: -1,
  },
  overlapLabel: {
    fontFamily: font.bodyBold,
    fontSize: 12.5,
    color: palette.inkSoft,
  },
  headerRight: { alignItems: 'flex-end' },
  sharedNum: {
    fontFamily: font.displayBlack,
    fontSize: 14,
    color: palette.ink,
  },
  sharedLabel: {
    fontFamily: font.body,
    fontSize: 11,
    color: palette.inkSoft,
  },

  barWrap: { paddingHorizontal: space.lg },
  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: palette.ink,
    backgroundColor: palette.card,
  },
  barSeg: { height: '100%' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
    gap: space.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  legendText: {
    fontFamily: font.mono,
    fontSize: 9.5,
    color: palette.inkSoft,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.ink,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.lg,
    borderTopWidth: 1.5,
    borderTopColor: palette.rule,
    backgroundColor: palette.coralSoft,
  },
  footerText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 12.5,
    color: palette.ink,
    fontWeight: '600',
  },
  footerStrong: {
    fontFamily: font.bodyBold,
    color: palette.ink,
  },
});
