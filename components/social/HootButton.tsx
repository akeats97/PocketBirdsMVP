import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { palette, radius } from '../../constants/Colors';
import { Owl } from '../Owl';

interface HootButtonProps {
  hooted: boolean;
  count: number;
  onPress: () => void;
}

// Compact pill toggle used on the sighting detail screen (the card uses the
// full split SocialFooter instead). Resting = outline owl + "Give a hoot";
// hooted = coral fill + "Hooted · N".
export function HootButton({ hooted, count, onPress }: HootButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[styles.pill, { backgroundColor: hooted ? palette.coralSoft : palette.card }]}
    >
      <Owl size={16} filled={hooted} color={hooted ? palette.coral : palette.inkSoft} />
      <Text style={[styles.label, { color: hooted ? palette.crimson : palette.ink }]}>
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
  label: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 12,
    letterSpacing: -0.2,
  },
});
