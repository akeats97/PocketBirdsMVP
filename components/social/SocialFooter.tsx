import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { border, font, palette, radius } from '../../constants/Colors';
import { Owl } from '../Owl';

interface SocialFooterProps {
  hooted: boolean;
  hootCount: number;
  commentCount?: number;
  /** Phase 1: render only the Hoot cell (no divider / comment cell). */
  onlyReaction?: boolean;
  onHoot: () => void;
  onComment?: () => void;
}

// The split action bar: Hoot on the left, Comment on the right, divided by a
// 2px ink rule inside a single bordered, clipped row. The comment slot is built
// from day one but hidden by `onlyReaction` so Phase 2 drops in with no
// relayout and the hoot tap target never moves.
export function SocialFooter({
  hooted,
  hootCount,
  commentCount = 0,
  onlyReaction = false,
  onHoot,
  onComment,
}: SocialFooterProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onHoot}
        style={[styles.cell, hooted && styles.cellHooted]}
        hitSlop={4}
      >
        <Owl size={20} filled={hooted} color={hooted ? palette.coral : palette.inkSoft} />
        <Text style={[styles.label, { color: hooted ? palette.crimson : palette.ink }]}>
          {hooted ? (hootCount > 0 ? `Hooted · ${hootCount}` : 'Hooted') : 'Give a hoot'}
        </Text>
      </Pressable>

      {!onlyReaction && (
        <>
          <View style={styles.divider} />
          <Pressable onPress={onComment} style={styles.cell} hitSlop={4}>
            <Ionicons name="chatbubble-outline" size={19} color={palette.inkSoft} />
            <Text style={[styles.label, { color: palette.ink }]}>
              {commentCount > 0 ? `Comment · ${commentCount}` : 'Comment'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderRadius: radius.input,
    overflow: 'hidden',
    backgroundColor: palette.card,
    ...border.thick,
  },
  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  cellHooted: {
    backgroundColor: palette.coralSoft,
  },
  divider: {
    width: 2,
    backgroundColor: palette.ink,
  },
  label: {
    fontFamily: font.display,
    fontSize: 13.5,
    letterSpacing: -0.2,
  },
});
