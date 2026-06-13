import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { HardShadow } from './SightingCard';
import { HoloFill, HoloRing } from './Holo';
import { font, palette, radius, space } from '../constants/Colors';
import { ConfettiPiece, PIECE_COUNT } from './MilestoneCelebration';

type Props = {
  visible: boolean;
  birdName: string | null;
  onDismiss: () => void;
};

// Temporarily disabled (Jun 12 2026): the gold takeover fires at LOG time, but
// global-first is moving to a photo + admin-verification model, so celebrating
// an unverified claim (e.g. a joke "boba" log) is premature. Flip back to true
// once verification ships and the celebration is wired to fire on verify.
// See WORK_QUEUE Q-4 / CLAUDE.md global-first notes.
const GLOBAL_FIRST_CELEBRATION_ENABLED = false;

// The rarest celebration: the user was the FIRST birder on all of PocketBirds
// to log this species. A clean white card with a holographic outline (the
// finish reserved for Global First) plus confetti + a celebratory haptic.
export default function GlobalFirstCelebration({ visible, birdName, onDismiss }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !birdName || !GLOBAL_FIRST_CELEBRATION_ENABLED) {
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

  if (!birdName || !GLOBAL_FIRST_CELEBRATION_ENABLED) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {visible && Array.from({ length: PIECE_COUNT }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <HardShadow offset={5} borderRadius={20}>
            <HoloRing radius={20}>
              <View style={styles.card}>
                <View style={styles.eyebrowPill}>
                  <HoloFill />
                  <Ionicons name="globe-outline" size={11} color={palette.ink} />
                  <Text style={styles.eyebrow}>GLOBAL FIRST</Text>
                </View>
                <Text style={styles.bird}>{birdName}</Text>
                <Text style={styles.tagline}>You&apos;re the first on Pocket Birds to log it.</Text>
                <Text style={styles.dismiss}>tap anywhere to keep birding</Text>
              </View>
            </HoloRing>
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
  // Clean white card with a holographic outline (the HoloRing) — understated to
  // match the Dex tile; the holo finish carries the rarity, not a loud colour.
  card: {
    backgroundColor: palette.card,
    borderRadius: 18,
    paddingVertical: 30,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 280,
  },
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.ink,
    overflow: 'hidden',
    marginBottom: 14,
  },
  eyebrow: {
    fontFamily: font.bodyBold,
    color: palette.ink,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  bird: {
    fontFamily: font.displayBlack,
    color: palette.ink,
    fontSize: 30,
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 34,
  },
  tagline: {
    fontFamily: font.body,
    color: palette.inkSoft,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 230,
    marginTop: 12,
  },
  dismiss: {
    fontFamily: font.mono,
    color: 'rgba(26, 36, 23, 0.4)',
    fontSize: 10,
    marginTop: 22,
    letterSpacing: 1.5,
  },
});
