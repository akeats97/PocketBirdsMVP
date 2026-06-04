import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { avatarColor } from '../../app/utils/avatarColor';
import { font, palette } from '../../constants/Colors';

interface AvatarProps {
  /** Display name; the first letter is shown. */
  name: string;
  /** Stable id (uid) used to pick a deterministic color. */
  seed: string;
  /** Side length in px (square). */
  size?: number;
}

// Rounded-square avatar, the app-wide convention (12px radius, 2px ink border,
// chunky display-black initial on a hashed accent color). Shared by the Friends
// screen and the social (hoot/comment) surfaces.
export function Avatar({ name, seed, size = 44 }: AvatarProps) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, backgroundColor: avatarColor(seed) },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.46 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: font.displayBlack,
    color: palette.cream,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
