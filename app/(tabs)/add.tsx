import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, Vibration, View } from 'react-native';
import SightingForm, { SightingFormValues } from '../../components/SightingForm';
import { HardShadow } from '../../components/SightingCard';
import { border, font, palette, radius, space } from '../../constants/Colors';
import { isCustomSpecies } from '../../constants/customSpecies';
import { isReportEntry } from '../../constants/reportTypes';
import GlobalFirstCelebration from '../components/GlobalFirstCelebration';
import MilestoneCelebration from '../components/MilestoneCelebration';
import { useSightings } from '../context/SightingsContext';
import { isGlobalFirstSpecies } from '../services/sightingService';

export default function AddSightingScreen() {
  const { addSighting, markGlobalFirst } = useSightings();
  const [showSuccess, setShowSuccess] = useState(false);
  const [isNewSpecies, setIsNewSpecies] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(false);
  const [milestoneCount, setMilestoneCount] = useState<number | null>(null);
  const [globalFirstBird, setGlobalFirstBird] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

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
      setShowSuccess(true);
      playSuccessBanner();
      return;
    }

    setSubmittedReport(false);

    // Global first: a brand-new species for the user that NO ONE on PocketBirds
    // has ever logged. Custom easter-egg species are excluded. Best effort —
    // needs the network; on failure we fall through to the normal celebration.
    if (newSpeciesDetected && !isCustomSpecies(birdName)) {
      try {
        const isFirst = await isGlobalFirstSpecies(birdName);
        if (isFirst) {
          markGlobalFirst(birdName);
          setGlobalFirstBird(birdName);
          return;
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
    setShowSuccess(true);

    if (newSpeciesDetected) {
      Vibration.vibrate([0, 150, 100, 150, 100, 300]);
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

      {showSuccess && (
        <Animated.View
          style={[styles.successPopup, { transform: [{ translateY: slideAnim }] }]}
        >
          <HardShadow offset={4} borderRadius={radius.input}>
            <View
              style={[
                styles.successPopupContent,
                (isNewSpecies || submittedReport) && styles.newSpeciesPopupContent,
              ]}
            >
              {!submittedReport && (
                <Ionicons
                  name={isNewSpecies ? 'star' : 'checkmark-circle'}
                  size={22}
                  color="#fff"
                />
              )}
              <Text style={styles.successPopupText}>
                {submittedReport
                  ? 'thank you for your hep ❤️'
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
  successPopupText: {
    fontFamily: font.bodyBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
