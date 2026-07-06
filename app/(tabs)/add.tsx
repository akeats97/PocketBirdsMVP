import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, Vibration, View } from 'react-native';
import SightingForm, { SightingFormValues } from '../../components/SightingForm';
import { HardShadow } from '../../components/SightingCard';
import { border, font, palette, radius, space } from '../../constants/Colors';
import { isCustomSpecies } from '../../constants/customSpecies';
import { isReportEntry } from '../../constants/reportTypes';
import GlobalFirstCelebration, { GLOBAL_FIRST_CELEBRATION_ENABLED } from '../../components/GlobalFirstCelebration';
import MilestoneCelebration, { ConfettiPiece, PIECE_COUNT } from '../../components/MilestoneCelebration';
import { useSightings } from '../context/SightingsContext';
import { useWishlist } from '../context/WishlistContext';
import { isGlobalFirstSpecies } from '../services/sightingService';

export default function AddSightingScreen() {
  const { addSighting, markGlobalFirst } = useSightings();
  const { wishlist } = useWishlist();
  const [showSuccess, setShowSuccess] = useState(false);
  const [isNewSpecies, setIsNewSpecies] = useState(false);
  const [wishlistCrossOff, setWishlistCrossOff] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(false);
  const [milestoneCount, setMilestoneCount] = useState<number | null>(null);
  const [globalFirstBird, setGlobalFirstBird] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // Confetti rain over the form for every new species (the milestone and
  // global-first takeovers bring their own). The key remounts the pieces so
  // back-to-back new species re-fire the burst.
  const [confettiKey, setConfettiKey] = useState(0);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rainConfetti = () => {
    setConfettiKey(k => k + 1);
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(() => setConfettiKey(0), 5000);
  };

  useEffect(() => () => {
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
  }, []);

  const playSuccessBanner = () => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccess(false);
      slideAnim.setValue(-100);
    });
  };

  // Validation lives in SightingForm; this trusts a valid selection. The form
  // clears its own fields after calling onSubmit.
  const handleSubmit = async (values: SightingFormValues) => {
    const isReport = isReportEntry(values.birdName);
    const birdName = values.birdName;

    const { isNewSpecies: newSpeciesDetected, milestone } = addSighting({
      birdName: values.birdName,
      location: values.location,
      date: values.date,
      notes: values.notes,
      photoUrl: undefined,
      photoPath: values.photoUri || undefined,
      coordinates: values.coordinates,
    });

    // Reports get their own thank-you banner — no milestone, new-species
    // celebration, or haptic buzz.
    if (isReport) {
      setSubmittedReport(true);
      setIsNewSpecies(false);
      setWishlistCrossOff(false);
      setShowSuccess(true);
      playSuccessBanner();
      return;
    }

    setSubmittedReport(false);

    // Global first: a brand-new species for the user that NO ONE on PocketBirds
    // has ever logged. Custom easter-egg species are excluded. Best effort —
    // needs the network; on failure we fall through to the normal celebration.
    // Only take the takeover's early return while it actually renders; with the
    // celebration flag off, a global-first must still get the normal milestone /
    // new-species celebration below (WORK_QUEUE Bug 8: silent submit).
    if (newSpeciesDetected && !isCustomSpecies(birdName)) {
      try {
        const isFirst = await isGlobalFirstSpecies(birdName);
        if (isFirst) {
          markGlobalFirst(birdName);
          if (GLOBAL_FIRST_CELEBRATION_ENABLED) {
            setGlobalFirstBird(birdName);
            return;
          }
        }
      } catch {
        // offline / query failed — fall through to the normal celebration
      }
    }

    if (milestone) {
      setMilestoneCount(milestone);
      return;
    }

    setIsNewSpecies(newSpeciesDetected);
    // Wishlist cross-off: first sighting of a species the user had starred.
    // The star itself stays (deliberate); the global-first and milestone
    // takeovers above outrank this and skip it via their early returns.
    setWishlistCrossOff(newSpeciesDetected && wishlist.has(birdName));
    setShowSuccess(true);

    if (newSpeciesDetected) {
      Vibration.vibrate([0, 150, 100, 150, 100, 300]);
      rainConfetti();
    }

    playSuccessBanner();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.cream }}>
      <MilestoneCelebration
        visible={milestoneCount !== null}
        count={milestoneCount}
        onDismiss={() => setMilestoneCount(null)}
      />

      <GlobalFirstCelebration
        visible={globalFirstBird !== null}
        birdName={globalFirstBird}
        onDismiss={() => setGlobalFirstBird(null)}
      />

      {confettiKey > 0 && (
        <View key={confettiKey} pointerEvents="none" style={styles.confettiLayer}>
          {Array.from({ length: PIECE_COUNT }).map((_, i) => (
            <ConfettiPiece key={i} index={i} />
          ))}
        </View>
      )}

      {showSuccess && (
        <Animated.View
          style={[styles.successPopup, { transform: [{ translateY: slideAnim }] }]}
        >
          <HardShadow offset={4} borderRadius={radius.input}>
            <View
              style={[
                styles.successPopupContent,
                (isNewSpecies || submittedReport) && styles.newSpeciesPopupContent,
                wishlistCrossOff && styles.wishlistPopupContent,
              ]}
            >
              {!submittedReport && (
                <Ionicons
                  name={isNewSpecies ? 'star' : 'checkmark-circle'}
                  size={22}
                  color={wishlistCrossOff ? palette.ink : '#fff'}
                />
              )}
              <Text style={[styles.successPopupText, wishlistCrossOff && styles.wishlistPopupText]}>
                {submittedReport
                  ? 'thank you for your hep ❤️'
                  : wishlistCrossOff
                    ? 'One off the wishlist!'
                    : isNewSpecies
                      ? 'New species added to your dex!'
                      : 'Sighting logged successfully!'}
              </Text>
            </View>
          </HardShadow>
        </Animated.View>
      )}

      <SightingForm mode="add" onSubmit={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1001,
    elevation: 11,
  },
  successPopup: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: space.lg,
    right: space.lg,
    zIndex: 1000,
    elevation: 10,
  },
  successPopupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: palette.leaf,
    borderRadius: radius.input,
    ...border.thick,
  },
  newSpeciesPopupContent: {
    backgroundColor: palette.coral,
  },
  // Wishlist cross-off wears the wishlist's gold (star = sun across the Dex),
  // so it needs ink text instead of white.
  wishlistPopupContent: {
    backgroundColor: palette.sun,
  },
  wishlistPopupText: {
    color: palette.ink,
  },
  successPopupText: {
    fontFamily: font.bodyBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
