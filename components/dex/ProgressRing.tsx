import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { font, palette } from '../../constants/Colors';

// The Dex hero's gold goal ring. Fills clockwise from 12 o'clock toward the
// annual species goal; the center carries this year's species count. With no
// active goal the caller passes progress=1, so the ring reads as a full
// celebratory circle rather than an empty track.
export function ProgressRing({
  size = 92,
  stroke = 8,
  progress,
  center,
}: {
  size?: number;
  stroke?: number;
  progress: number; // 0..1, caller clamps
  center: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(250, 246, 234, 0.22)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Fill */}
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={palette.sun}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - clamped)}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.centerText}>{center}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    color: palette.cream,
    letterSpacing: -0.8,
  },
});

export default ProgressRing;
