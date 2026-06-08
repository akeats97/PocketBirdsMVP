import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, palette } from '../../constants/Colors';

// The "?" placeholder shown for a Mystery Bird that has no user photo: a 45°
// hatched muted field, a dark wash, and a centered cream-on-ink "?" disc. The
// web reference uses a repeating-linear-gradient; RN has no gradient primitive,
// so the hatch is a row of rotated bars over the muted base.
const HATCH_DARK = '#9aa396'; // the darker stripe color from the reference

interface MysteryPhotoProps {
  height?: number;
  /** Diameter of the "?" disc; scaled down for small thumbnails. */
  discSize?: number;
}

export function MysteryPhoto({ height = 190, discSize }: MysteryPhotoProps) {
  // Enough diagonal bars to cover the field at any width.
  const bars = Array.from({ length: 40 });
  const disc = discSize ?? Math.min(64, Math.round(height * 0.34) + 18);

  return (
    <View style={[styles.field, { height }]}>
      <View style={styles.hatch} pointerEvents="none">
        {bars.map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: -height,
              bottom: -height,
              left: i * 20 - height,
              width: 10,
              backgroundColor: HATCH_DARK,
              transform: [{ rotate: '45deg' }],
            }}
          />
        ))}
      </View>
      <View style={styles.wash} pointerEvents="none" />
      <View
        style={[
          styles.disc,
          { width: disc, height: disc, borderRadius: disc / 2 },
        ]}
      >
        <Text style={[styles.q, { fontSize: Math.round(disc * 0.56) }]}>?</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    backgroundColor: palette.muted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hatch: {
    ...StyleSheet.absoluteFillObject,
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,36,23,0.28)',
  },
  disc: {
    backgroundColor: palette.cream,
    borderWidth: 2.5,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  q: {
    fontFamily: font.displayBlack,
    color: palette.ink,
    fontWeight: '800',
  },
});
