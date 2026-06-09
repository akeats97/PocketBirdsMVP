import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SightingForm, { SightingFormValues } from '../../../components/SightingForm';
import { HardShadow } from '../../../components/SightingCard';
import { border, font, palette, radius, space, type } from '../../../constants/Colors';
import MilestoneCelebration from '../../components/MilestoneCelebration';
import { SightingPatch, useSightings } from '../../context/SightingsContext';

// Map the form's single photo value back onto the sighting's two photo fields.
// A remote https URL is the unchanged existing photo; a local file uri is a new
// pick that still needs uploading; null means the photo was removed.
function photoPatch(photoUri: string | null): Pick<SightingPatch, 'photoUrl' | 'photoPath'> {
  if (!photoUri) return { photoUrl: undefined, photoPath: undefined };
  if (photoUri.startsWith('http')) return { photoUrl: photoUri, photoPath: undefined };
  return { photoPath: photoUri, photoUrl: undefined };
}

export default function EditSightingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sightingId = String(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = insets.top;

  const { sightings, updateSighting } = useSightings();
  const sighting = useMemo(() => sightings.find(s => s.id === sightingId), [sightings, sightingId]);

  const [showSuccess, setShowSuccess] = useState(false);
  const [milestoneCount, setMilestoneCount] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // Slide the "Changes saved" banner in, hold, slide out, then pop back to
  // wherever the user came from (Journal or detail).
  const playBannerThenBack = () => {
    setShowSuccess(true);
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(slideAnim, { toValue: -100, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      router.back();
    });
  };

  const handleSubmit = (values: SightingFormValues) => {
    if (!sighting) return;

    const patch: SightingPatch = {
      birdName: values.birdName,
      location: values.location,
      date: values.date,
      notes: values.notes,
      coordinates: values.coordinates,
      ...photoPatch(values.photoUri),
    };

    const { isNewSpecies, milestone } = updateSighting(sighting.id, patch);

    // A new species that crossed a milestone gets the milestone takeover; on
    // dismiss we pop back. Otherwise show the inline "Changes saved" banner
    // (with the lifer haptic when it's a new species), then pop back.
    if (milestone) {
      setMilestoneCount(milestone);
      return;
    }
    if (isNewSpecies) {
      Vibration.vibrate([0, 150, 100, 150, 100, 300]);
    }
    playBannerThenBack();
  };

  const NavBar = (
    <View style={[styles.navBar, { paddingTop: topInset + space.sm }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={palette.ink} />
      </Pressable>
      <Text style={styles.navTitle}>Edit Sighting</Text>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );

  if (!sighting) {
    return (
      <View style={styles.screen}>
        {NavBar}
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Couldn&apos;t load this sighting.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {NavBar}

      {showSuccess && (
        <Animated.View
          style={[styles.banner, { top: topInset + 52, transform: [{ translateY: slideAnim }] }]}
        >
          <HardShadow offset={4} borderRadius={radius.input}>
            <View style={styles.bannerContent}>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.bannerText}>Changes saved</Text>
            </View>
          </HardShadow>
        </Animated.View>
      )}

      <SightingForm mode="edit" initial={sighting} onSubmit={handleSubmit} />

      <MilestoneCelebration
        visible={milestoneCount !== null}
        count={milestoneCount}
        onDismiss={() => {
          setMilestoneCount(null);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: palette.ink,
  },
  backBtn: { padding: 2 },
  navTitle: { ...type.h3, color: palette.ink },
  cancelBtn: { marginLeft: 'auto', padding: 2 },
  cancelText: { ...type.body, color: palette.muted, fontWeight: '700' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.body, color: palette.inkSoft },

  banner: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    zIndex: 1000,
    elevation: 10,
  },
  bannerContent: {
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
  bannerText: {
    fontFamily: font.bodyBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
