import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, palette, space } from '../../constants/Colors';

export type ConnectionTab = 'followers' | 'following';

interface Props {
  followers: number;
  following: number;
  onOpen: (tab: ConnectionTab) => void;
}

// Two side-by-side link-style cells (deliberately unboxed, to read as links and
// stay distinct from the boxed Species/Sightings stat card right below). The
// count shown equals the length of the list the tap opens. See handoff §1.
export function SocialCounts({ followers, following, onOpen }: Props) {
  const cells: { key: ConnectionTab; n: number; label: string }[] = [
    { key: 'followers', n: followers, label: 'Followers' },
    { key: 'following', n: following, label: 'Following' },
  ];
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {cells.map((c, i) => (
          <Pressable
            key={c.key}
            onPress={() => onOpen(c.key)}
            style={[styles.cell, i === 0 ? styles.cellFirst : styles.cellDivided]}
          >
            <View style={{ minWidth: 0 }}>
              <Text style={styles.count}>{c.n}</Text>
              <Text style={styles.label}>{c.label.toUpperCase()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={13} color={palette.muted} style={styles.chevron} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: space.md,
    paddingHorizontal: space.xl,
  },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  cellFirst: {},
  cellDivided: {
    paddingLeft: space.lg,
    borderLeftWidth: 1.5,
    borderLeftColor: palette.rule,
  },
  count: {
    fontFamily: font.display,
    fontSize: 19,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.5,
    lineHeight: 19,
  },
  label: {
    fontFamily: font.mono,
    fontSize: 9,
    color: palette.inkSoft,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  chevron: { marginLeft: 'auto' },
});
