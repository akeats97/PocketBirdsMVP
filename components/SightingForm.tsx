import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { HardShadow } from './SightingCard';
import { birdNamesAlpha, birdNamesAlphaNorm, birdNamesAlphaCompact, normalizeSearch } from '../constants/birdNamesLower';
import { border, font, palette, radius, recipes, space, type } from '../constants/Colors';
import { CUSTOM_SPECIES } from '../constants/customSpecies';
import { REPORT_TYPES, isReportEntry } from '../constants/reportTypes';
import { UNKNOWN_BIRD } from '../constants/unknownBird';
import { useSightings } from '../app/context/SightingsContext';
import { pickImage } from '../app/services/photoService';
import { getCurrentLocationWithLabel, hasLocationPermission, requestLocationPermission } from '../app/services/locationService';
import { getPlaceCoordinates, getPlacesAutocomplete, PlaceSuggestion } from '../app/services/placesService';
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

export default function SightingForm({ mode, initial, onSubmit, submitting }: SightingFormProps) {
  const { lastLocation, evaluateNewSpecies } = useSightings();
  const isEdit = mode === 'edit';

  const [searchQuery, setSearchQuery] = useState(isEdit ? initial?.birdName ?? '' : '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedBird, setSelectedBird] = useState(isEdit ? initial?.birdName ?? '' : '');
  const [location, setLocation] = useState(isEdit ? initial?.location ?? '' : lastLocation.label);
  const [locationCoords, setLocationCoords] = useState<Coordinates | undefined>(
    isEdit ? initial?.coordinates : lastLocation.coordinates
  );
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [shouldAutocompleteLocation, setShouldAutocompleteLocation] = useState(false);
  const [notes, setNotes] = useState(isEdit ? initial?.notes ?? '' : '');
  const [date, setDate] = useState(isEdit ? initial?.date ?? new Date() : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(
    isEdit ? initial?.photoUrl ?? initial?.photoPath ?? null : null
  );
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
  }, [lastLocation, isEdit]);

  // Debounced Google Places autocomplete. Only fires when the user actively
  // typed into the location field (not on pre-fill, locate, or suggestion tap).
  useEffect(() => {
    if (!shouldAutocompleteLocation) return;
    if (!location || location.trim().length < 2) {
      setPlaceSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      const results = await getPlacesAutocomplete(location, lastLocation.coordinates);
      setPlaceSuggestions(results);
    }, 300);
    return () => clearTimeout(handle);
  }, [location, shouldAutocompleteLocation, lastLocation.coordinates]);

  const handleLocationChange = (text: string) => {
    setLocation(text);
    setLocationCoords(undefined);
    setShouldAutocompleteLocation(true);
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

  const handlePlaceSuggestionSelect = async (suggestion: PlaceSuggestion) => {
    setShouldAutocompleteLocation(false);
    setPlaceSuggestions([]);
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
  // word-start > substring. Cap to 20. (Same hot-path search as Add.)
  useEffect(() => {
    if (!searchQuery || searchQuery === selectedBird) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      const q = normalizeSearch(searchQuery);

      if (q.startsWith('?')) {
        setSuggestions([UNKNOWN_BIRD]);
        return;
      }

      const qSpace = ' ' + q;
      const qCompact = q.replace(/ /g, '');
      const CAP = 20;
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
          if (tier0.length < CAP) tier0.push(birdNamesAlpha[i]);
        } else if (tier0.length < CAP) {
          if (norm.includes(qSpace)) {
            if (tier1.length < CAP) tier1.push(birdNamesAlpha[i]);
          } else if (norm.includes(q)) {
            if (tier2.length < CAP) tier2.push(birdNamesAlpha[i]);
          } else if (birdNamesAlphaCompact[i].includes(qCompact)) {
            if (tier3.length < CAP) tier3.push(birdNamesAlpha[i]);
          }
        }
        if (tier0.length >= CAP) break;
      }

      setSuggestions([...reportMatches, ...customMatches, ...tier0, ...tier1, ...tier2, ...tier3].slice(0, CAP));
    }, 100);
    return () => clearTimeout(handle);
  }, [searchQuery, selectedBird]);

  const handleBirdSelect = (bird: string) => {
    setSelectedBird(bird);
    setSearchQuery(bird);
    setSuggestions([]);
    Keyboard.dismiss();
  };

  // Mystery Bird toggle. Mirrors handleBirdSelect(UNKNOWN_BIRD) on the way in
  // and a full clear on the way out. isMystery is derived, so it also reflects
  // active state when editing an existing Mystery Bird sighting.
  const isMystery = selectedBird === UNKNOWN_BIRD;

  const toggleMystery = () => {
    Keyboard.dismiss();
    setSuggestions([]);
    if (isMystery) {
      setSelectedBird('');
      setSearchQuery('');
    } else {
      setSelectedBird(UNKNOWN_BIRD);
      setSearchQuery(UNKNOWN_BIRD);
    }
  };

  const handleSelectPhoto = async () => {
    try {
      const result = await pickImage();
      if (!result.canceled) {
        setPhotoUri(result.assets[0].uri);
      }
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
      setPhotoUri(null);
    }
  };

  const handleOutsidePress = () => {
    if (suggestions.length > 0) setSuggestions([]);
    if (placeSuggestions.length > 0) setPlaceSuggestions([]);
    Keyboard.dismiss();
  };

  // Cue reflects what saving will do. Only a changed name can be a new species;
  // exclude this sighting from the comparison so "changed to a bird I already
  // have elsewhere" reads as quiet.
  const nameChanged =
    isEdit && !!initial && selectedBird.toLowerCase() !== initial.birdName.toLowerCase();
  const cueIsNew = nameChanged ? evaluateNewSpecies(selectedBird, initial!.id).isNewSpecies : false;

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="interactive"
      bottomOffset={20}
      onScrollBeginDrag={handleOutsidePress}
    >
      <Pressable onPress={handleOutsidePress} android_disableSound={true}>
        <View style={styles.innerContainer}>
          {!isEdit && <Text style={styles.title}>Add Sighting</Text>}

          <View style={styles.form}>
            {/* Bird Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>BIRD</Text>
              <View style={styles.birdRow}>
                <TextInput
                  ref={textInputRef}
                  style={[styles.input, { flex: 1 }, selectedBird ? styles.inputDisplay : null]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="What'd you see?"
                  placeholderTextColor={palette.muted}
                  onBlur={() => setSuggestions([])}
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
                      <Pressable
                        key={item}
                        style={({ pressed }) => [
                          styles.suggestionButton,
                          i === suggestions.length - 1 && styles.suggestionButtonLast,
                          pressed && { backgroundColor: palette.leafSoft },
                        ]}
                        onPress={() => handleBirdSelect(item)}
                      >
                        <Text style={styles.suggestionButtonText}>{item}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
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
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setDate(selectedDate);
                    }
                  }}
                  maximumDate={new Date()}
                />
              )}
            </View>

            {/* Location */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>LOCATION</Text>
              <View style={styles.locationRow}>
                <TextInput
                  ref={locationInputRef}
                  style={[styles.input, { flex: 1 }]}
                  value={location}
                  onChangeText={handleLocationChange}
                  placeholder="Where did you see it?"
                  placeholderTextColor={palette.muted}
                  onBlur={() => setPlaceSuggestions([])}
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
              {placeSuggestions.length > 0 && (
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
              )}
            </View>

            {/* Photo */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PHOTO</Text>
              <TouchableOpacity
                style={[
                  photoUri ? styles.photoButtonFilled : styles.photoButtonEmpty,
                  { height: photoUri ? 200 : 88 },
                ]}
                onPress={handleSelectPhoto}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera" size={24} color={palette.inkSoft} />
                    <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                  </View>
                )}
                {photoUri && (
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => setPhotoUri(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close" size={16} color={palette.ink} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>NOTES</Text>
              <TextInput
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
                    {isEdit ? 'Save Changes' : 'Save Sighting'}
                  </Text>
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
