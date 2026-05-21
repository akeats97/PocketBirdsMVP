import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { HardShadow } from '../../components/SightingCard';
import { font, palette, radius, space } from '../../constants/Colors';
import { milestoneTagline } from '../constants/milestones';

const SCREEN = Dimensions.get('window');
const PIECE_COUNT = 45;
const CONFETTI_COLORS = [palette.leaf, palette.sun, palette.sky, palette.coral, palette.crimson];

type ConfettiPieceProps = {
  index: number;
};

function ConfettiPiece({ index }: ConfettiPieceProps) {
  const cfg = useRef({
    startX: Math.random() * SCREEN.width,
    driftX: (Math.random() - 0.5) * 120,
    duration: 2000 + Math.random() * 1800,
    delay: index * 22,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 6,
    rotateTurns: (Math.random() - 0.5) * 4,
  }).current;

  const translateY = useRef(new Animated.Value(-40)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN.height + 60,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: cfg.driftX,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 1,
        duration: cfg.duration,
        delay: cfg.delay,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(cfg.delay + cfg.duration - 500),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const rotateInterp = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${cfg.rotateTurns * 360}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: cfg.startX,
        width: cfg.size,
        height: cfg.size * 1.6,
        backgroundColor: cfg.color,
        borderRadius: 1.5,
        opacity,
        transform: [
          { translateY },
          { translateX },
          { rotate: rotateInterp },
        ],
      }}
    />
  );
}

type Props = {
  visible: boolean;
  count: number | null;
  onDismiss: () => void;
};

export default function MilestoneCelebration({ visible, count, onDismiss }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || count == null) {
      scaleAnim.setValue(0.6);
      fadeAnim.setValue(0);
      return;
    }
    Vibration.vibrate([0, 120, 60, 120, 60, 220, 60, 380]);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, count]);

  if (count == null) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {visible && Array.from({ length: PIECE_COUNT }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
        <Animated.View
          style={[
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <HardShadow offset={5} borderRadius={radius.card}>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>MILESTONE</Text>
              <Text style={styles.number}>{count}</Text>
              <Text style={styles.label}>SPECIES</Text>
              <View style={styles.divider} />
              <Text style={styles.tagline}>{milestoneTagline(count)}</Text>
              <Text style={styles.dismiss}>tap anywhere to keep birding</Text>
            </View>
          </HardShadow>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 36, 23, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  card: {
    backgroundColor: palette.ink,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: palette.ink,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 280,
  },
  eyebrow: {
    fontFamily: font.bodyBold,
    color: palette.sun,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 4,
  },
  number: {
    fontFamily: font.displayBlack,
    color: palette.sun,
    fontSize: 96,
    fontWeight: '900',
    lineHeight: 100,
    letterSpacing: -3,
  },
  label: {
    fontFamily: font.display,
    color: palette.cream,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 5,
    marginTop: -2,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: palette.sun,
    marginVertical: 18,
  },
  tagline: {
    fontFamily: font.display,
    color: palette.cream,
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    letterSpacing: -0.3,
  },
  dismiss: {
    fontFamily: font.mono,
    color: 'rgba(253, 246, 230, 0.55)',
    fontSize: 10,
    marginTop: 32,
    letterSpacing: 1.5,
  },
});
