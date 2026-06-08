import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { palette, radius } from '../../constants/Colors';
import { Owl } from '../Owl';

interface HootButtonProps {
  hooted: boolean;
  count: number;
  onPress: () => void;
  /** 'sm' is the compact variant used on community-ID proposal rows. */
  size?: 'sm' | 'md';
}

// Compact pill toggle used on the sighting detail screen (the card uses the
// full split SocialFooter instead). Resting = outline owl + "Give a hoot";
// hooted = coral fill + "Hooted · N". The same reaction visuals are reused on
// community-ID proposals via the `sm` variant.
export function HootButton({ hooted, count, onPress, size = 'md' }: HootButtonProps) {
  const sm = size === 'sm';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.pill,
        sm && styles.pillSm,
        { backgroundColor: hooted ? palette.coralSoft : palette.card },
      ]}
    >
      <Owl size={sm ? 14 : 16} filled={hooted} color={hooted ? palette.coral : palette.inkSoft} />
      <Text style={[styles.label, sm && styles.labelSm, { color: hooted ? palette.crimson : palette.ink }]}>
        {hooted ? (count > 0 ? `Hooted · ${count}` : 'Hooted') : 'Give a hoot'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.ink,
  },
  pillSm: {
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  label: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 12,
    letterSpacing: -0.2,
  },
  labelSm: {
    fontSize: 11,
  },
});
