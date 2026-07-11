import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import ClearableInput from './ClearableInput';
import { HardShadow } from './SightingCard';
import { birdNamesAlpha, birdNamesAlphaNorm, birdNamesAlphaCompact, normalizeSearch } from '../constants/birdNamesLower';
import { realmForCoordinates, regionsFor } from '../constants/birdNames';
import { rangeStatusFor, hasRegion } from '../constants/birdRanges';
import { border, font, palette, radius, recipes, space, type } from '../constants/Colors';
import { CUSTOM_SPECIES } from '../constants/customSpecies';
import { REPORT_TYPES, isReportEntry } from '../constants/reportTypes';
import { UNKNOWN_BIRD } from '../constants/unknownBird';
import { useSightings } from '../app/context/SightingsContext';
import { pickImage, readPhotoMetadata, requestPhotoPermission } from '../app/services/photoService';
import { getCurrentCoordinates, getCurrentLocationWithLabel, hasLocationPermission, requestLocationPermission, reverseGeocodeLabel, reverseGeocodeRegion } from '../app/services/locationService';
import { getPlaceCoordinates, getPlacesAutocomplete, PlaceSuggestion } from '../app/services/placesService';
import { buildRecentLocations, RecentLocation } from '../app/utils/recentLocations';
import { Coordinates, Sighting } from '../app/types';

export interface SightingFormValues {
  birdName: string;
  location: string;
  date: Date;
  notes?: string;
  // Current photo: a remote https URL (unchanged), a local file uri (newly
  // picked or not-yet-uploaded), or null (none / removed). The submitter
  // decides how to persist it.
  photoUri: string | null;
  coordinates?: Coordinates;
}

interface SightingFormProps {
  mode: 'add' | 'edit';
  /** The sighting to edit. Required in edit mode; used to pre-fill every field. */
  initial?: Sighting;
  onSubmit: (values: SightingFormValues) => void;
  submitting?: boolean;
}

// The contextual notification cue shown under the BIRD field in edit mode. It
// mirrors exactly what saving will do: nothing (a quiet edit), or a new-species
// add that notifies followers. Recomputed on every bird change.
function NotifyCue({ isNew, birdName }: { isNew: boolean; birdName: string }) {
  if (isNew) {
    return (
      <View style={styles.cueNew}>
        <View style={styles.cueIcon}>
          <Ionicons name="star" size={16} color={palette.coral} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cueNewTitle}>New species for you</Text>
          <Text style={styles.cueBody}>
            {birdName} isn&apos;t in your dex yet. Saving adds it and notifies followers.
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.cueSilent}>
      <View style={styles.cueIcon}>
        <Ionicons name="notifications-off" size={16} color={palette.muted} />
      </View>
      <Text style={[styles.cueBody, { flex: 1 }]}>
        <Text style={styles.cueBodyStrong}>Quiet edit.</Text> You&apos;ve logged this species
        before, so saving won&apos;t notify anyone.
      </Text>
    </View>
  );
}

// The dropdown escape hatch into Mystery Bird (Community ID's front door).
// Rendered in two spots: as the body of the no-match dropdown (typed a guess,
// got nothing back) and as a footer under a populated results list (typed
// "gull", got twenty gulls, no idea which). Same row, different lead line.
function MysteryCtaRow({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.mysteryCtaRow, pressed && { backgroundColor: palette.sun }]}
      onPress={onPress}
    >
      <View style={styles.mysteryCtaTile}>
        <Text style={styles.mysteryCtaTileGlyph}>?</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.mysteryCtaTitle}>{title}</Text>
        <Text style={styles.mysteryCtaSub}>Your friends can help identify it</Text>
      </View>
      <Ionicons name="arrow-forward" size={15} color={palette.leaf} />
    </Pressable>
  );
}

export default function SightingForm({ mode, initial, onSubmit, submitting }: SightingFormProps) {
  const { lastLocation, evaluateNewSpecies, sightings } = useSightings();
  const isEdit = mode === 'edit';

  const [searchQuery, setSearchQuery] = useState(isEdit ? initial?.birdName ?? '' : '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // How many of the leading `suggestions` are in the user's realm. Drives the
  // "Most likely near you" / "Everywhere else" section split. 0 = no split.
  const [likelyCount, setLikelyCount] = useState(0);
  // True only after the debounced search actually ran and found nothing, so
  // the "no matches" dropdown never flashes during the 100ms debounce window.
  const [noMatch, setNoMatch] = useState(false);
  const [selectedBird, setSelectedBird] = useState(isEdit ? initial?.birdName ?? '' : '');
  const [location, setLocation] = useState(isEdit ? initial?.location ?? '' : lastLocation.label);
  const [locationCoords, setLocationCoords] = useState<Coordinates | undefined>(
    isEdit ? initial?.coordinates : lastLocation.coordinates
  );
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [shouldAutocompleteLocation, setShouldAutocompleteLocation] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const [biasCoords, setBiasCoords] = useState<Coordinates | undefined>(undefined);
  const [notes, setNotes] = useState(isEdit ? initial?.notes ?? '' : '');
  const [date, setDate] = useState(isEdit ? initial?.date ?? new Date() : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Date provenance (add mode). A photo's capture date autofills DATE, but only
  // while the field still holds its untouched default; a date the user picked
  // is never overwritten. dateFromPhoto drives the small hint under the field.
  const [dateEdited, setDateEdited] = useState(false);
  const [dateFromPhoto, setDateFromPhoto] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(
    isEdit ? initial?.photoUrl ?? initial?.photoPath ?? null : null
  );
  // Coordinates read from the picked photo's metadata (add mode). Highest-
  // priority signal for ranking the bird list, and stays put even if the user
  // later edits the location text.
  const [photoCoords, setPhotoCoords] = useState<Coordinates | undefined>(undefined);
  // Whether the LOCATION label was autofilled from the picked photo's GPS.
  // Drives the small "Location from your photo" hint, mirroring dateFromPhoto.
  const [locationFromPhoto, setLocationFromPhoto] = useState(false);
  const textInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
  const locationInputRef = useRef<TextInput>(null);

  // In ADD mode the location field tracks lastLocation (the remembered prefill).
  // In edit mode it's seeded from the sighting and must NOT be overwritten.
  useEffect(() => {
    if (isEdit) return;
    setLocation(lastLocation.label);
    setLocationCoords(lastLocation.coordinates);
    setShouldAutocompleteLocation(false);
    setPlaceSuggestions([]);
    setLocationFromPhoto(false);
  }, [lastLocation, isEdit]);

  // The user's most-recently-logged locations, shown when the location field
  // is focused and empty. Free path — no Google Places call.
  const recentLocations = useMemo(() => buildRecentLocations(sightings), [sightings]);

  // The realm used to rank the bird list. Priority: photo location (best — it's
  // where the bird actually was) -> the location attached to this sighting
  // (prefill / locate / place pick) -> silent current position. Null if we have
  // no coordinates at all, in which case search stays plain alphabetical.
  const activeRealm = useMemo(
    () => realmForCoordinates(photoCoords ?? locationCoords ?? biasCoords),
    [photoCoords, locationCoords, biasCoords]
  );

  // The fine (state/province) region for the same coords, resolved by reverse-
  // geocode. Ranks the bird list by admin-1 range where we have data (tells a
  // Black-billed Magpie in Alberta from a California-only Yellow-billed, which
  // realm can't). Null until resolved / on failure -> realm ranking stands in.
  const [activeRegion, setActiveRegion] = useState<{
    countryCode: string;
    province: string;
  } | null>(null);
  const rankCoords = photoCoords ?? locationCoords ?? biasCoords;
  useEffect(() => {
    if (!rankCoords) {
      setActiveRegion(null);
      return;
    }
    let cancelled = false;
    reverseGeocodeRegion(rankCoords).then(region => {
      if (!cancelled) setActiveRegion(region);
    });
    return () => {
      cancelled = true;
    };
  }, [rankCoords?.latitude, rankCoords?.longitude]);

  // Add mode proactively asks for the two permissions this screen depends on:
  // location (photo-location autofill, species ranking, autocomplete biasing)
  // and photos (picking + reading the photo's GPS). Asking up front means the
  // photo flow doesn't silently run without them. Sequential on purpose,
  // stacked system dialogs are disorienting. Both are no-ops when already
  // granted or permanently denied. Then resolve the current position for
  // autocomplete biasing (edit mode skips the prompts and stays silent-only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isEdit) {
        await requestLocationPermission();
        await requestPhotoPermission();
      }
      const coords = await getCurrentCoordinates();
      if (!cancelled && coords) setBiasCoords(coords);
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit]);

  // Debounced Google Places autocomplete. Only fires when the user actively
  // typed into the location field (not on pre-fill, locate, or suggestion tap).
  useEffect(() => {
    if (!shouldAutocompleteLocation) return;
    if (!location || location.trim().length < 2) {
      setPlaceSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      const results = await getPlacesAutocomplete(location, biasCoords ?? lastLocation.coordinates);
      setPlaceSuggestions(results);
    }, 300);
    return () => clearTimeout(handle);
  }, [location, shouldAutocompleteLocation, biasCoords, lastLocation.coordinates]);

  const handleLocationChange = (text: string) => {
    setLocation(text);
    setLocationCoords(undefined);
    setShouldAutocompleteLocation(true);
    setLocationFromPhoto(false);
  };

  const handleLocateTap = async () => {
    locationInputRef.current?.blur();
    Keyboard.dismiss();
    let granted = await hasLocationPermission();
    if (!granted) granted = await requestLocationPermission();
    if (!granted) {
      Alert.alert(
        'Location permission needed',
        'Enable location access in Settings to use the locate button.'
      );
      return;
    }
    const result = await getCurrentLocationWithLabel();
    if (!result) {
      Alert.alert(
        "Couldn't get your location",
        "Make sure GPS is on and you have signal. If you're offline, type the location manually."
      );
      return;
    }
    setShouldAutocompleteLocation(false);
    setPlaceSuggestions([]);
    setLocationCoords(result.coordinates);
    setLocationFromPhoto(false);
    if (result.label) {
      setLocation(result.label);
      return;
    }
    Alert.alert(
      'Coordinates saved',
      "We got your location, but we're offline so we couldn't look up the place name. Type the name of this spot and your coordinates will stay attached.",
      [{ text: 'OK', onPress: () => locationInputRef.current?.focus() }]
    );
  };

  const handleRecentSelect = (recent: RecentLocation) => {
    setShouldAutocompleteLocation(false);
    setPlaceSuggestions([]);
    setLocation(recent.label);
    setLocationCoords(recent.coordinates);
    setLocationFromPhoto(false);
    Keyboard.dismiss();
  };

  const handlePlaceSuggestionSelect = async (suggestion: PlaceSuggestion) => {
    setShouldAutocompleteLocation(false);
    setPlaceSuggestions([]);
    setLocationFromPhoto(false);
    Keyboard.dismiss();
    const result = await getPlaceCoordinates(suggestion.placeId);
    if (result) {
      setLocation(result.label);
      setLocationCoords(result.coordinates);
    } else {
      setLocation(suggestion.description);
      setLocationCoords(undefined);
    }
  };

  // Filter bird names based on search query (debounced 100ms). Rank: prefix >
  // word-start > substring. Cap to 20. (Same hot-path search as Add.) When we
  // know the user's realm, species that live there float to the top under a
  // "Most likely near you" section.
  useEffect(() => {
    if (!searchQuery || searchQuery === selectedBird) {
      setSuggestions([]);
      setLikelyCount(0);
      setNoMatch(false);
      return;
    }
    const handle = setTimeout(() => {
      const q = normalizeSearch(searchQuery);

      if (q.startsWith('?')) {
        setSuggestions([UNKNOWN_BIRD]);
        setLikelyCount(0);
        setNoMatch(false);
        return;
      }

      const qSpace = ' ' + q;
      const qCompact = q.replace(/ /g, '');
      const CAP = 20;
      // Gather more than we display so in-realm matches aren't truncated before
      // ranking. (For specific queries like "magpie" the pool is far smaller.)
      const COLLECT = 60;
      const tier0: string[] = [];
      const tier1: string[] = [];
      const tier2: string[] = [];
      const tier3: string[] = [];

      const reportMatches =
        q.length >= 2 ? REPORT_TYPES.filter(rt => rt.toLowerCase().startsWith(q)) : [];
      const customMatches =
        q.length >= 2 ? CUSTOM_SPECIES.filter(c => c.toLowerCase().startsWith(q)) : [];

      for (let i = 0; i < birdNamesAlpha.length; i++) {
        const norm = birdNamesAlphaNorm[i];
        if (norm.startsWith(q)) {
          if (tier0.length < COLLECT) tier0.push(birdNamesAlpha[i]);
        } else if (tier0.length < COLLECT) {
          if (norm.includes(qSpace)) {
            if (tier1.length < COLLECT) tier1.push(birdNamesAlpha[i]);
          } else if (norm.includes(q)) {
            if (tier2.length < COLLECT) tier2.push(birdNamesAlpha[i]);
          } else if (birdNamesAlphaCompact[i].includes(qCompact)) {
            if (tier3.length < COLLECT) tier3.push(birdNamesAlpha[i]);
          }
        }
        if (tier0.length >= COLLECT) break;
      }

      const birds = [...tier0, ...tier1, ...tier2, ...tier3];
      const hasFixed = reportMatches.length + customMatches.length > 0;

      // "Near you" ranking only applies to plain bird searches. Report / custom
      // matches are pinned at the very top and never sectioned.
      const useRegion =
        !hasFixed && activeRegion && hasRegion(activeRegion.countryCode, activeRegion.province);
      if (useRegion) {
        // Admin-1 ranking: a species is "most likely near you" if it's expected
        // in the user's state/province. Species with no GBIF range data (the
        // ~12%) fall back to the coarser realm test so they're still placed.
        const { countryCode, province } = activeRegion!;
        const likely: string[] = [];
        const unlikely: string[] = [];
        for (const name of birds) {
          const status = rangeStatusFor(name, countryCode, province);
          const isLikely =
            status === 'expected' ||
            (status === 'unknown' && !!activeRealm && regionsFor(name).includes(activeRealm));
          (isLikely ? likely : unlikely).push(name);
        }
        setSuggestions([...likely, ...unlikely].slice(0, CAP));
        setLikelyCount(Math.min(likely.length, CAP));
      } else if (activeRealm && !hasFixed) {
        const inRealm: string[] = [];
        const outRealm: string[] = [];
        for (const name of birds) {
          if (regionsFor(name).includes(activeRealm)) inRealm.push(name);
          else outRealm.push(name);
        }
        setSuggestions([...inRealm, ...outRealm].slice(0, CAP));
        setLikelyCount(Math.min(inRealm.length, CAP));
      } else {
        setSuggestions([...reportMatches, ...customMatches, ...birds].slice(0, CAP));
        setLikelyCount(0);
      }
      setNoMatch(birds.length === 0 && !hasFixed);
    }, 100);
    return () => clearTimeout(handle);
  }, [searchQuery, selectedBird, activeRealm, activeRegion]);

  // Typing in the BIRD field must invalidate a prior selection the moment the
  // text diverges from it. Otherwise selectedBird (what Save submits, and what
  // drives the "validated" bold styling) stays pinned to the old pick while the
  // box shows new text — so editing "Tufted Titmouse" to something else and
  // hitting Save silently logs the titmouse. Mirrors handleLocationChange,
  // which clears locationCoords on every keystroke for the same reason.
  const handleBirdQueryChange = (text: string) => {
    setSearchQuery(text);
    if (selectedBird && text !== selectedBird) setSelectedBird('');
  };

  const handleBirdSelect = (bird: string) => {
    setSelectedBird(bird);
    setSearchQuery(bird);
    setSuggestions([]);
    setNoMatch(false);
    Keyboard.dismiss();
  };

  // Mystery Bird toggle. Mirrors handleBirdSelect(UNKNOWN_BIRD) on the way in
  // and a full clear on the way out. isMystery is derived, so it also reflects
  // active state when editing an existing Mystery Bird sighting.
  const isMystery = selectedBird === UNKNOWN_BIRD;

  // Shared by the ? button and the two dropdown escape hatches (the no-match
  // CTA and the "not sure which one" footer under the results).
  const selectMystery = () => handleBirdSelect(UNKNOWN_BIRD);

  const toggleMystery = () => {
    if (isMystery) {
      Keyboard.dismiss();
      setSuggestions([]);
      setNoMatch(false);
      setSelectedBird('');
      setSearchQuery('');
    } else {
      selectMystery();
    }
  };

  const handleSelectPhoto = async () => {
    try {
      const result = await pickImage();
      if (result.canceled) return;
      const asset = result.assets[0];
      setPhotoUri(asset.uri);

      // In add mode the photo drives the sighting's location: it's where the
      // bird actually was, which beats "where I'm standing now" for both ranking
      // the bird list and filling in the location field.
      if (isEdit) return;
      const { coords, capturedAt } = await readPhotoMetadata(asset);

      // The photo also knows WHEN the bird was seen. Autofill the untouched
      // default date (never a user-picked one); a replacement photo without a
      // capture date must not leave the previous photo's date behind. Ignore
      // future timestamps (bad camera clocks) so the save validation never
      // trips on a date the user didn't choose.
      if (capturedAt && capturedAt <= new Date() && !dateEdited) {
        setDate(capturedAt);
        setDateFromPhoto(true);
      } else if (!capturedAt && dateFromPhoto) {
        setDate(new Date());
        setDateFromPhoto(false);
      }

      if (!coords) {
        // A GPS-less replacement must not keep ranking by the previous photo,
        // nor claim the location still came from a photo.
        setPhotoCoords(undefined);
        setLocationFromPhoto(false);
        return;
      }
      setPhotoCoords(coords);
      setLocationCoords(coords);
      setShouldAutocompleteLocation(false);
      setPlaceSuggestions([]);
      // Naming the spot means reverse-geocoding, which requires LOCATION
      // permission on Android (the picker only grants PHOTO permission). Ask for
      // it once so the label can autofill; the coords and the "near you" ranking
      // already work without it.
      let granted = await hasLocationPermission();
      if (!granted) granted = await requestLocationPermission();
      const label = granted ? await reverseGeocodeLabel(coords) : '';
      console.log(
        '[SightingForm] photo coords attached:', coords.latitude, coords.longitude,
        '| locPermission =', granted, '| geocoded label =', label || '(none)'
      );
      // The photo's location is authoritative. Overwrite the remembered prefill
      // (or empty field) with the photo's place name. If we couldn't resolve a
      // name, clear the prefill too — leaving the PREVIOUS sighting's label
      // paired with THIS photo's coordinates would be wrong. Never clobber a
      // location the user typed or picked themselves.
      const applied = !!label && (location.trim() === '' || location === lastLocation.label);
      setLocation(prev => (prev.trim() === '' || prev === lastLocation.label ? label : prev));
      setLocationFromPhoto(applied);
    } catch (error) {
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const handleSave = () => {
    if (submitting) return;
    if (!selectedBird) {
      Alert.alert('Error', 'Please select a bird');
      return;
    }
    const isReport = isReportEntry(selectedBird);
    if (!isReport && !location) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }
    // The picker no longer clamps to today (clamping mid-entry punished
    // month-first scrolling), so the honest constraint moves here.
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (date > endOfToday) {
      Alert.alert('Nice try, time traveler', "That date hasn't happened yet. Pick one that has.");
      return;
    }

    onSubmit({
      birdName: selectedBird,
      location,
      date,
      notes: notes || undefined,
      photoUri,
      coordinates: locationCoords,
    });

    // Add mode clears the form for the next entry (location persists as the
    // remembered prefill, mirroring the original Add flow). Edit mode navigates
    // away, so there's nothing to reset.
    if (!isEdit) {
      setSelectedBird('');
      setSearchQuery('');
      setNotes('');
      setDate(new Date());
      setDateEdited(false);
      setDateFromPhoto(false);
      setPhotoUri(null);
      setPhotoCoords(undefined);
      setLocationFromPhoto(false);
    }
  };

  const handleOutsidePress = () => {
    if (suggestions.length > 0) setSuggestions([]);
    if (noMatch) setNoMatch(false);
    if (placeSuggestions.length > 0) setPlaceSuggestions([]);
    // Cancel any in-flight debounced Places fetch, otherwise it resolves right
    // after this and re-shows the dropdown (it renders on placeSuggestions, not
    // focus). Then blur so the cursor actually leaves the field, not just the
    // keyboard closing.
    setShouldAutocompleteLocation(false);
    locationInputRef.current?.blur();
    textInputRef.current?.blur();
    Keyboard.dismiss();
  };

  // Cue reflects what saving will do. Only a changed name can be a new species;
  // exclude this sighting from the comparison so "changed to a bird I already
  // have elsewhere" reads as quiet.
  const nameChanged =
    isEdit && !!initial && selectedBird.toLowerCase() !== initial.birdName.toLowerCase();
  const cueIsNew = nameChanged ? evaluateNewSpecies(selectedBird, initial!.id).isNewSpecies : false;

  // Only section the list when the realm split is meaningful — some matches are
  // local and some aren't. All-local or all-elsewhere shows no headers.
  const showRealmSections = likelyCount > 0 && likelyCount < suggestions.length;

  // Photo field. Rendered first (and larger, with an encouraging hint) in add
  // mode; kept in its original position in edit mode. It's the lead of the Add
  // flow but never required — the hint says so and the rest of the form works
  // without it.
  const photoField = (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>PHOTO</Text>
      <TouchableOpacity
        style={[
          photoUri ? styles.photoButtonFilled : styles.photoButtonEmpty,
          { height: photoUri ? 200 : isEdit ? 88 : 140 },
        ]}
        onPress={handleSelectPhoto}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera" size={isEdit ? 24 : 32} color={palette.inkSoft} />
            <Text style={styles.photoPlaceholderText}>Add a photo</Text>
          </View>
        )}
        {photoUri && (
          <TouchableOpacity
            style={styles.removePhotoButton}
            onPress={() => {
              setPhotoUri(null);
              setPhotoCoords(undefined);
              // A "from photo" location hint goes with the removed photo (the
              // label stays put — it's still a valid place, just no longer
              // attributable to the photo).
              setLocationFromPhoto(false);
              // A date the removed photo supplied goes with it.
              if (dateFromPhoto) {
                setDate(new Date());
                setDateFromPhoto(false);
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Remove photo"
          >
            <Ionicons name="close" size={16} color={palette.ink} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="interactive"
      bottomOffset={20}
      onScrollBeginDrag={handleOutsidePress}
    >
      <Pressable
        onPress={handleOutsidePress}
        android_disableSound={true}
        style={{ flexGrow: 1 }}
      >
        <View style={styles.innerContainer}>
          {!isEdit && <Text style={styles.title}>Add Sighting</Text>}

          <View style={styles.form}>
            {/* Photo — leads the Add flow (add mode only). */}
            {!isEdit && photoField}

            {/* Bird Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>BIRD</Text>
              <View style={styles.birdRow}>
                <ClearableInput
                  ref={textInputRef}
                  containerStyle={{ flex: 1 }}
                  style={[styles.input, selectedBird ? styles.inputDisplay : null]}
                  value={searchQuery}
                  onChangeText={handleBirdQueryChange}
                  onClear={() => {
                    setSelectedBird('');
                    setSearchQuery('');
                    setSuggestions([]);
                    setNoMatch(false);
                  }}
                  placeholder="Who'd you see?"
                  placeholderTextColor={palette.muted}
                  onBlur={() => {
                    setSuggestions([]);
                    setNoMatch(false);
                  }}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.mysteryButton,
                    isMystery && styles.mysteryButtonActive,
                    pressed && !isMystery && { backgroundColor: palette.sun },
                  ]}
                  onPress={toggleMystery}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isMystery }}
                  accessibilityLabel={isMystery ? 'Clear Mystery Bird' : 'Log as Mystery Bird'}
                >
                  <Text style={[styles.mysteryGlyph, isMystery && styles.mysteryGlyphActive]}>?</Text>
                </Pressable>
              </View>
              {suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView
                    style={styles.suggestionsScrollView}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  >
                    {suggestions.map((item, i) => (
                      <React.Fragment key={item}>
                        {showRealmSections && i === 0 && (
                          <Text style={styles.suggestionSectionHeader}>MOST LIKELY NEAR YOU</Text>
                        )}
                        {showRealmSections && i === likelyCount && (
                          <Text
                            style={[styles.suggestionSectionHeader, styles.suggestionSectionHeaderDivided]}
                          >
                            EVERYWHERE ELSE
                          </Text>
                        )}
                        <Pressable
                          style={({ pressed }) => [
                            styles.suggestionButton,
                            i === suggestions.length - 1 && styles.suggestionButtonLast,
                            pressed && { backgroundColor: palette.leafSoft },
                          ]}
                          onPress={() => handleBirdSelect(item)}
                        >
                          <Text style={styles.suggestionButtonText}>{item}</Text>
                        </Pressable>
                      </React.Fragment>
                    ))}
                    {/* Footer escape hatch: matches, but none you can vouch
                        for ("which of these gulls was it?"). */}
                    <MysteryCtaRow
                      title="Not sure which? Log a Mystery Bird"
                      onPress={selectMystery}
                    />
                  </ScrollView>
                </View>
              )}
              {/* Dead-end catcher: the search came back empty, so the dropdown
                  offers the intended path instead of silence. */}
              {noMatch && (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.noMatchText}>
                    {`No matches for "${searchQuery.trim()}"`}
                  </Text>
                  <MysteryCtaRow title="Log as Mystery Bird" onPress={selectMystery} />
                </View>
              )}
              {/* Community-ID explainer, revealed the instant Mystery Bird is
                  chosen (add mode; edit mode's cue row owns that slot). */}
              {!isEdit && isMystery && (
                <View style={styles.mysteryExplainer}>
                  <View style={styles.mysteryExplainerHeader}>
                    <Ionicons name="people" size={14} color={palette.coral} />
                    <Text style={styles.mysteryExplainerLabel}>What happens next</Text>
                  </View>
                  <Text style={styles.mysteryExplainerBody}>
                    It posts to your friends&apos; feeds so they can{' '}
                    <Text style={styles.mysteryExplainerBold}>propose an ID</Text>. Accept one and
                    the species drops into your Dex.
                  </Text>
                </View>
              )}
            </View>

            {/* Notification cue — edit mode only (Add celebrates on save). */}
            {isEdit && <NotifyCue isNew={cueIsNew} birdName={selectedBird} />}

            {/* Date */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>DATE</Text>
              <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>
                  {date.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                <Ionicons name="calendar" size={18} color={palette.ink} />
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant="light"
                  onChange={(event, selectedDate) => {
                    // Android's dialog fires once, on OK/cancel, so closing
                    // here is right. The iOS spinner fires on every wheel
                    // settle (closing would eject the picker after a single
                    // column pick), so it stays open until the Done row.
                    if (Platform.OS !== 'ios') setShowDatePicker(false);
                    if (selectedDate) {
                      setDate(selectedDate);
                      setDateEdited(true);
                      setDateFromPhoto(false);
                    }
                  }}
                />
              )}
              {showDatePicker && Platform.OS === 'ios' && (
                <Pressable
                  style={styles.dateDoneButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.dateDoneText}>Done</Text>
                </Pressable>
              )}
              {dateFromPhoto && (
                <View style={styles.dateFromPhotoRow}>
                  <Ionicons name="image-outline" size={12} color={palette.inkSoft} />
                  <Text style={styles.dateFromPhotoText}>Date from your photo</Text>
                </View>
              )}
            </View>

            {/* Location */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>LOCATION</Text>
              <View style={styles.locationRow}>
                <ClearableInput
                  ref={locationInputRef}
                  containerStyle={{ flex: 1 }}
                  style={styles.input}
                  value={location}
                  onChangeText={handleLocationChange}
                  onClear={() => {
                    handleLocationChange('');
                    locationInputRef.current?.focus();
                  }}
                  placeholder="Where did you see it?"
                  placeholderTextColor={palette.muted}
                  onFocus={() => setLocationFocused(true)}
                  onBlur={() => {
                    setLocationFocused(false);
                    setPlaceSuggestions([]);
                  }}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.locateButton,
                    pressed && { backgroundColor: palette.sunSoft },
                  ]}
                  onPress={handleLocateTap}
                  accessibilityLabel="Use my current location"
                >
                  <Ionicons
                    name="locate"
                    size={22}
                    color={locationCoords ? palette.leaf : palette.ink}
                  />
                </Pressable>
              </View>
              {locationFocused && location.trim() === '' && recentLocations.length > 0 ? (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.recentsHeader}>RECENT</Text>
                  <ScrollView
                    style={styles.suggestionsScrollView}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  >
                    {recentLocations.map((r, i) => (
                      <Pressable
                        key={r.label}
                        style={({ pressed }) => [
                          styles.suggestionButton,
                          styles.recentRow,
                          i === recentLocations.length - 1 && styles.suggestionButtonLast,
                          pressed && { backgroundColor: palette.leafSoft },
                        ]}
                        onPress={() => handleRecentSelect(r)}
                      >
                        <Ionicons name="time-outline" size={16} color={palette.inkSoft} />
                        <Text style={styles.suggestionButtonText}>{r.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : placeSuggestions.length > 0 ? (
                <View style={styles.suggestionsContainer}>
                  <ScrollView
                    style={styles.suggestionsScrollView}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  >
                    {placeSuggestions.map((s, i) => (
                      <Pressable
                        key={s.placeId}
                        style={({ pressed }) => [
                          styles.suggestionButton,
                          i === placeSuggestions.length - 1 && styles.suggestionButtonLast,
                          pressed && { backgroundColor: palette.leafSoft },
                        ]}
                        onPress={() => handlePlaceSuggestionSelect(s)}
                      >
                        <Text style={styles.suggestionButtonText}>{s.mainText}</Text>
                        {s.secondaryText ? (
                          <Text style={styles.suggestionSecondaryText}>{s.secondaryText}</Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {locationFromPhoto && (
                <View style={styles.dateFromPhotoRow}>
                  <Ionicons name="image-outline" size={12} color={palette.inkSoft} />
                  <Text style={styles.dateFromPhotoText}>Location from your photo</Text>
                </View>
              )}
            </View>

            {/* Photo — original position in edit mode. */}
            {isEdit && photoField}

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>NOTES</Text>
              <ClearableInput
                ref={notesInputRef}
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything worth remembering?"
                placeholderTextColor={palette.muted}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Save */}
            <View style={styles.saveWrap}>
              <HardShadow offset={4} borderRadius={radius.input}>
                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && { backgroundColor: palette.ink },
                  ]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>
                    {isEdit
                      ? 'Save Changes'
                      : isMystery
                        ? 'Save & ask friends to ID'
                        : 'Save Sighting'}
                  </Text>
                  {/* The primary action names the outcome: saving a Mystery
                      Bird is asking your flock for help. */}
                  {!isEdit && isMystery && (
                    <Text style={styles.saveButtonSub}>Posts to your friends&apos; feeds</Text>
                  )}
                </Pressable>
              </HardShadow>
            </View>
          </View>
        </View>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
  },
  title: {
    ...type.h1,
    color: palette.ink,
    fontWeight: '700',
    marginBottom: space.lg,
  },
  form: {
    gap: space.md,
  },
  fieldGroup: {
    marginBottom: 0,
  },
  label: {
    ...recipes.fieldLabel,
  },

  input: {
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    ...border.thick,
    fontFamily: font.body,
    fontSize: 16,
    color: palette.ink,
  },
  inputDisplay: {
    fontFamily: font.bodyBold,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: space.md,
  },

  // Notification cue — sits directly under the BIRD field.
  cueSilent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: palette.cream,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: palette.rule,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
  },
  cueNew: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: palette.coralSoft,
    borderRadius: radius.input,
    ...border.thick,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
  },
  cueIcon: {
    marginTop: 1,
  },
  cueNewTitle: {
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  cueBody: {
    ...type.bodyS,
    color: palette.inkSoft,
    lineHeight: 17,
  },
  cueBodyStrong: {
    fontFamily: font.bodyBold,
    color: palette.ink,
  },

  birdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  mysteryButton: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    backgroundColor: palette.sunSoft,
    ...border.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mysteryButtonActive: {
    backgroundColor: palette.ink,
  },
  mysteryGlyph: {
    fontFamily: font.display,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
    color: palette.ink,
  },
  mysteryGlyphActive: {
    color: palette.cream,
  },

  // Mystery CTA row inside the suggestions dropdown (footer + no-match).
  mysteryCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: palette.sunSoft,
  },
  mysteryCtaTile: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mysteryCtaTileGlyph: {
    fontFamily: font.display,
    fontSize: 17,
    fontWeight: '800',
    color: palette.cream,
  },
  mysteryCtaTitle: {
    fontFamily: font.display,
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  mysteryCtaSub: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 1,
  },
  noMatchText: {
    ...type.bodyS,
    color: palette.muted,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },

  // "What happens next" explainer under the BIRD field while Mystery is set.
  mysteryExplainer: {
    marginTop: space.sm,
    backgroundColor: palette.sunSoft,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: palette.ink,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
  },
  mysteryExplainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    marginBottom: space.xs,
  },
  mysteryExplainerLabel: {
    ...type.monoTag,
    color: palette.ink,
  },
  mysteryExplainerBody: {
    ...type.bodyS,
    color: palette.ink,
    lineHeight: 18,
  },
  mysteryExplainerBold: {
    fontFamily: font.bodyBold,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  locateButton: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    backgroundColor: palette.sun,
    ...border.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },

  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: palette.card,
    borderRadius: radius.input,
    ...border.thick,
    marginTop: space.xs,
    zIndex: 9999,
    elevation: 8,
    maxHeight: 220,
    overflow: 'hidden',
  },
  suggestionsScrollView: {
    maxHeight: 220,
  },
  suggestionButton: {
    width: '100%',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
    backgroundColor: palette.card,
  },
  suggestionButtonLast: {
    borderBottomWidth: 0,
  },
  suggestionButtonText: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '500',
  },
  suggestionSecondaryText: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 2,
  },
  recentsHeader: {
    ...recipes.fieldLabel,
    marginBottom: 0,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
  },
  suggestionSectionHeader: {
    ...recipes.fieldLabel,
    marginBottom: 0,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    paddingHorizontal: space.lg,
    backgroundColor: palette.card,
  },
  suggestionSectionHeaderDivided: {
    borderTopWidth: 1,
    borderTopColor: palette.rule,
    paddingTop: space.md,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    ...border.thick,
  },
  dateFromPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
  },
  dateFromPhotoText: {
    ...type.bodyS,
    color: palette.inkSoft,
  },
  dateDoneButton: {
    alignSelf: 'flex-end',
    marginTop: space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: palette.card,
    borderRadius: radius.input,
    ...border.thick,
  },
  dateDoneText: {
    ...type.body,
    fontFamily: font.bodyBold,
    color: palette.ink,
  },
  dateButtonText: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '500',
  },

  saveWrap: {
    marginTop: space.md,
    alignSelf: 'stretch',
  },
  saveButton: {
    ...recipes.buttonPrimary,
    paddingVertical: space.md + 2,
  },
  saveButtonText: {
    ...recipes.buttonPrimaryText,
  },
  saveButtonSub: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
  },

  photoButtonEmpty: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: radius.input,
    borderWidth: 2,
    borderColor: palette.ink,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  photoButtonFilled: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: radius.input,
    ...border.thick,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.xs,
  },
  photoPlaceholderText: {
    ...type.bodyS,
    color: palette.inkSoft,
    fontWeight: '600',
  },
  removePhotoButton: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.cream,
    ...border.thick,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
