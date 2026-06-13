import React from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { holo } from '../constants/Colors';

// Holographic gradient as an absolute-fill layer (react-native-svg, which is
// already a native dependency — avoids adding expo-linear-gradient + a native
// rebuild). Put it behind content inside a parent that has borderRadius +
// overflow:'hidden' so the corners clip. Reserved for Global First.
//
// react-native-svg needs real pixel dimensions to paint a full-bleed gradient
// ("100%" on <Svg> doesn't resolve to the parent size and leaves gaps), so we
// measure with onLayout and draw the <Rect> at the measured size. Each instance
// also gets a unique gradient id — <Defs> ids are shared across <Svg> elements,
// so a fixed id collides when several holo tiles render at once.
//
// We round the measured size up and paint a 1px BLEED past every edge, offset to
// overhang. On Android a fractional layout height (e.g. 18.48) gets truncated
// when the SVG rasterizes, leaving an unpainted sliver at the bottom/right edge
// (visible on small surfaces like the global-first "1ST" pill). Overdrawing then
// letting the parent's overflow:'hidden' clip it back guarantees full coverage.
// Every HoloFill consumer clips, so the bleed is never visible.
let holoSeq = 0;

const BLEED = 1;

export function HoloFill() {
  const id = React.useMemo(() => `holo${holoSeq++}`, []);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };
  const w = Math.ceil(size.w) + BLEED * 2;
  const h = Math.ceil(size.h) + BLEED * 2;
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {size.w > 0 && size.h > 0 && (
        <Svg width={w} height={h} style={{ position: 'absolute', top: -BLEED, left: -BLEED }}>
          <Defs>
            <LinearGradient
              id={id}
              x1={holo.start.x * w}
              y1={holo.start.y * h}
              x2={holo.end.x * w}
              y2={holo.end.y * h}
              gradientUnits="userSpaceOnUse"
            >
              {holo.colors.map((c, i) => (
                <Stop key={i} offset={holo.locations[i]} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
}

// Wrap any card to give it a holographic shimmer border. `padding` is the ring
// thickness; the child should be opaque so only the ring shows.
export function HoloRing({
  radius = 16,
  padding = 2.5,
  children,
  style,
}: {
  radius?: number;
  padding?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', padding }, style]}>
      <HoloFill />
      {children}
    </View>
  );
}
