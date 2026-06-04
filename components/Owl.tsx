import React from 'react';
import { Image, View } from 'react-native';
import { palette } from '../constants/Colors';

// The hand-drawn owl is the identifying asset for the Hoot reaction. It's a
// transparent-alpha PNG (367×477); `tintColor` recolors the opaque pixels, so
// the same artwork reads as ink when resting and coral when hooted.
const OWL_ASPECT = 367 / 477; // ≈ 0.77, width tracks height at this ratio

interface OwlProps {
  /** Height in px. Width is derived from the asset aspect ratio. */
  size?: number;
  /** Active ("hooted") state: tints the disc coralSoft. */
  filled?: boolean;
  /** Wrap the owl in a soft tinted circle (the active button + badges). */
  disc?: boolean;
  /** Owl linework color. Defaults to the resting `inkSoft`. */
  color?: string;
}

export function Owl({ size = 24, filled = false, disc = false, color }: OwlProps) {
  const image = (
    <Image
      source={require('../assets/images/owl.png')}
      style={{
        width: Math.round(size * OWL_ASPECT),
        height: size,
        tintColor: color ?? palette.inkSoft,
      }}
      resizeMode="contain"
    />
  );

  if (!disc) return image;

  const d = Math.round(size * 1.32);
  return (
    <View
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: filled ? palette.coralSoft : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {image}
    </View>
  );
}
