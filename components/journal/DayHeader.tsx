import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, space, type } from '../../constants/Colors';

// Shared day-section header for the journals (home feed + profile journal).
// Tapping toggles the day collapsed; the counts line stays visible either way
// so a folded day still tells you what's inside.
export function DayHeader({
  title,
  sightingCount,
  speciesCount,
  collapsed,
  onToggle,
}: {
  title: string;
  sightingCount: number;
  speciesCount: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.wrap} onPress={onToggle} hitSlop={4}>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.counts}>
          {sightingCount} {sightingCount === 1 ? 'sighting' : 'sightings'} · {speciesCount} {speciesCount === 1 ? 'species' : 'species'}
        </Text>
      </View>
      <Ionicons
        name={collapsed ? 'chevron-forward' : 'chevron-down'}
        size={18}
        color={palette.inkSoft}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    backgroundColor: palette.cream,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...type.h3,
    color: palette.ink,
    fontWeight: '700',
  },
  counts: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 2,
    fontWeight: '500',
  },
});

export default DayHeader;
