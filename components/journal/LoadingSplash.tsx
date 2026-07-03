import React, { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { font, palette } from '../../constants/Colors';

// "l👀king for birds..." — the Field Journal open splash. Googly eyes replace the
// "oo" and track a bird flying past on a shared 4s loop; the dots hop on their own
// 1.1s loop. Ported from design_handoff_loading_splash (timings are the spec).
const EYE = 15;
const PUPIL = EYE * 0.36;

// Dot-hop stagger (0 / 0.12s / 0.24s) as a fraction of the 1.1s dot loop.
const DOT_DELAYS = [0, 0.12 / 1.1, 0.24 / 1.1];

export default function LoadingSplash() {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const p = useSharedValue(0); // master 4s loop: bird, pupils, lids
  const d = useSharedValue(0); // dot-hop 1.1s loop

  useEffect(() => {
    if (reducedMotion) return; // static line: eyes centered, no bird, no hop
    // Hold calm for 1s before the bird/eye sequence starts; the dots keep
    // hopping through the wait so the splash still feels alive.
    p.value = withDelay(1000, withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false));
    d.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(p);
      cancelAnimation(d);
    };
  }, [reducedMotion, p, d]);

  // Bird: X is constant speed (holds offscreen right through the 1s idle, then
  // crosses to offscreen left); Y+tilt is one smooth arch over the text.
  const birdX = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(p.value, [0, 0.25, 0.62, 1], [0, 0, -(width + 130), -(width + 130)]) },
    ],
  }));
  const birdArc = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(p.value, [0, 0.25, 0.435, 0.62, 1], [0, 0, -64, 6, 6]) },
      { rotate: `${interpolate(p.value, [0, 0.25, 0.435, 0.62, 1], [0, 0, -4, 5, 5])}deg` },
    ],
  }));

  // Pupils dart to the entering bird, track it across, then settle center.
  // Offsets are fractions of eye size.
  const IN = [0, 0.24, 0.28, 0.44, 0.6, 0.68, 0.78, 1];
  const pupil = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(p.value, IN, [0, 0, EYE * 0.2, 0, -EYE * 0.2, -EYE * 0.2, 0, 0]) },
      { translateY: interpolate(p.value, IN, [0, 0, -EYE * 0.06, -EYE * 0.14, -EYE * 0.06, -EYE * 0.02, 0, 0]) },
    ],
  }));

  // Lid closes top-down: an idle single blink, then a double blink after the
  // bird exits.
  const lid = useAnimatedStyle(() => ({
    transform: [
      { scaleY: interpolate(p.value, [0, 0.08, 0.1, 0.11, 0.13, 0.82, 0.84, 0.86, 0.88, 1], [0, 0, 1, 1, 0, 0, 1, 1, 0, 0]) },
    ],
  }));

  const dot0 = useDotStyle(d, DOT_DELAYS[0]);
  const dot1 = useDotStyle(d, DOT_DELAYS[1]);
  const dot2 = useDotStyle(d, DOT_DELAYS[2]);

  const renderEye = () => (
    <View style={styles.eye}>
      <Animated.View style={[styles.pupil, pupil]} />
      <Animated.View style={[styles.lid, lid]} />
    </View>
  );

  return (
    <View style={styles.container}>
      {!reducedMotion && (
        <Animated.View style={[styles.skybird, birdX]}>
          <Animated.View style={birdArc}>
            <Text style={styles.birdEmoji}>🐦</Text>
          </Animated.View>
        </Animated.View>
      )}

      <View style={styles.loadRow}>
        <Text style={styles.loadText}>l</Text>
        <View style={styles.eyes}>
          {renderEye()}
          {renderEye()}
        </View>
        <Text style={styles.loadText}>king for birds</Text>
        <Animated.Text style={[styles.loadText, dot0]}>.</Animated.Text>
        <Animated.Text style={[styles.loadText, dot1]}>.</Animated.Text>
        <Animated.Text style={[styles.loadText, dot2]}>.</Animated.Text>
      </View>
    </View>
  );
}

// Each dot hops (0 -> -7 -> 0) on the 1.1s loop, offset by its stagger delay.
function useDotStyle(d: Animated.SharedValue<number>, delayFrac: number) {
  return useAnimatedStyle(() => {
    const phase = (d.value + delayFrac) % 1;
    return { transform: [{ translateY: interpolate(phase, [0, 0.25, 0.55, 1], [0, -7, 0, 0]) }] };
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  loadText: {
    fontFamily: font.display,
    fontSize: 26,
    color: palette.ink,
  },
  eyes: {
    flexDirection: 'row',
    gap: 1,
    marginLeft: 1,
    marginRight: 2,
    alignSelf: 'baseline',
  },
  eye: {
    width: EYE,
    height: EYE,
    borderRadius: EYE / 2,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: palette.ink,
    overflow: 'hidden',
  },
  pupil: {
    position: 'absolute',
    top: (EYE - PUPIL) / 2 - 2,
    left: (EYE - PUPIL) / 2 - 2,
    width: PUPIL,
    height: PUPIL,
    borderRadius: PUPIL / 2,
    backgroundColor: palette.ink,
  },
  lid: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    backgroundColor: palette.sunSoft,
    borderBottomWidth: 1.3,
    borderBottomColor: palette.ink,
    transformOrigin: 'top',
  },
  skybird: {
    position: 'absolute',
    top: '40%',
    right: -64,
  },
  birdEmoji: {
    fontSize: 34,
    lineHeight: 34,
  },
});
