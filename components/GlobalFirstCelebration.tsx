import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { HardShadow } from './SightingCard';
import { font, palette, radius, space } from '../constants/Colors';
import { ConfettiPiece, PIECE_COUNT } from './MilestoneCelebration';

type Props = {
  visible: boolean;
  birdName: string | null;
  onDismiss: () => void;
};

// The rarest celebration: the user was the FIRST birder on all of PocketBirds
// to log this species. A bold gold takeover (distinct from the dark milestone
// modal) with confetti + a celebratory haptic.
export default function GlobalFirstCelebration({ visible, birdName, onDismiss }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !birdName) {
      scaleAnim.setValue(0.6);
      fadeAnim.setValue(0);
      return;
    }
    Vibration.vibrate([0, 140, 70, 140, 70, 260, 80, 440]);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [visible, birdName]);

  if (!birdName) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {visible && Array.from({ length: PIECE_COUNT }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <HardShadow offset={5} borderRadius={radius.card}>
            <View style={styles.card}>
              <View style={styles.eyebrowRow}>
                <Ionicons name="trophy" size={16} color={palette.ink} />
                <Text style={styles.eyebrow}>GLOBAL FIRST</Text>
                <Ionicons name="trophy" size={16} color={palette.ink} />
              </View>
              <Text style={styles.bird}>{birdName}</Text>
              <View style={styles.divider} />
              <Text style={styles.tagline}>First birder on Pocket Birds to log this species!</Text>
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
  // Bold GOLD card (vs the milestone modal's dark card) — gold = the trophy /
  // achievement language, matching the gold trophy on the Dex tiles.
  card: {
    backgroundColor: palette.sun,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: palette.ink,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 280,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  eyebrow: {
    fontFamily: font.bodyBold,
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  bird: {
    fontFamily: font.displayBlack,
    color: palette.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 38,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: palette.ink,
    marginVertical: 18,
    opacity: 0.5,
  },
  tagline: {
    fontFamily: font.display,
    color: palette.ink,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 280,
    letterSpacing: -0.3,
  },
  dismiss: {
    fontFamily: font.mono,
    color: 'rgba(26, 36, 23, 0.55)',
    fontSize: 10,
    marginTop: 28,
    letterSpacing: 1.5,
  },
});
