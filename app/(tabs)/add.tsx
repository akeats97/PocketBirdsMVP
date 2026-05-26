import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { HardShadow } from '../../components/SightingCard';
import { birdNamesAlpha, birdNamesAlphaLower } from '../../constants/birdNamesLower';
import { border, font, palette, radius, recipes, space, type } from '../../constants/Colors';
import MilestoneCelebration from '../components/MilestoneCelebration';
import { useSightings } from '../context/SightingsContext';
import { pickImage } from '../services/photoService';
import { getCurrentLocationWithLabel, hasLocationPermission, requestLocationPermission } from '../services/locationService';
import { getPlaceCoordinates, getPlacesAutocomplete, PlaceSuggestion } from '../services/placesService';
import { Coordinates } from '../types';

export default function AddSightingScreen() {
  const navigation = useNavigation();
  const { addSighting, lastLocation } = useSightings();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedBird, setSelectedBird] = useState('');
  const [location, setLocation] = useState(lastLocation.label);
  const [locationCoords, setLocationCoords] = useState<Coordinates | undefined>(lastLocation.coordinates);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [shouldAutocompleteLocation, setShouldAutocompleteLocation] = useState(false);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isNewSpecies, setIsNewSpecies] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [milestoneCount, setMilestoneCount] = useState<number | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);
  const locationInputRef = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        const focusedInput = Platform.select({
          ios: textInputRef.current?.isFocused() ? textInputRef.current :
               notesInputRef.current?.isFocused() ? notesInputRef.current :
               locationInputRef.current?.isFocused() ? locationInputRef.current : null,
          android: textInputRef.current?.isFocused() ? textInputRef.current :
                  notesInputRef.current?.isFocused() ? notesInputRef.current :
                  locationInputRef.current?.isFocused() ? locationInputRef.current : null
        });

        if (focusedInput) {
          setTimeout(() => {
            focusedInput.measure((x, y, width, height, pageX, pageY) => {
              const screenHeight = Dimensions.get('window').height;
              const inputBottom = pageY + height;
              const keyboardTop = screenHeight - e.endCoordinates.height;

              if (inputBottom > keyboardTop) {
                const scrollToY = pageY - (keyboardTop - inputBottom) - 100;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, scrollToY),
                  animated: true
                });
              }
            });
          }, 100);
        }
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Update location (label + coords) when lastLocation changes. Pre-fill should
  // never trigger Places autocomplete, so reset the flag.
  useEffect(() => {
    setLocation(lastLocation.label);
    setLocationCoords(lastLocation.coordinates);
    setShouldAutocompleteLocation(false);
    setPlaceSuggestions([]);
  }, [lastLocation]);

  // Debounced Google Places autocomplete. Only fires when the user has actively
  // typed into the location field (not on pre-fill, locate button, or
  // suggestion tap).
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
    // Got a GPS fix but reverse-geocode came back empty — usually means we're
    // offline (the native geocoder needs network). Coords are still attached;
    // nudge the user to type the place name.
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

  // Filter bird names based on search query (debounced 100ms to coalesce fast
  // typing). Rank: prefix > word-start > substring. Cap to 20.
  useEffect(() => {
    if (!searchQuery || searchQuery === selectedBird) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      const q = searchQuery.toLowerCase();
      const qSpace = ' ' + q;
      const qDash = '-' + q;
      const CAP = 20;
      const tier0: string[] = [];
      const tier1: string[] = [];
      const tier2: string[] = [];

      for (let i = 0; i < birdNamesAlpha.length; i++) {
        const lower = birdNamesAlphaLower[i];
        if (lower.startsWith(q)) {
          if (tier0.length < CAP) tier0.push(birdNamesAlpha[i]);
        } else if (tier0.length < CAP) {
          if (lower.includes(qSpace) || lower.includes(qDash)) {
            if (tier1.length < CAP) tier1.push(birdNamesAlpha[i]);
          } else if (lower.includes(q)) {
            if (tier2.length < CAP) tier2.push(birdNamesAlpha[i]);
          }
        }
        if (tier0.length >= CAP) break;
      }

      setSuggestions([...tier0, ...tier1, ...tier2].slice(0, CAP));
    }, 100);
    return () => clearTimeout(handle);
  }, [searchQuery, selectedBird]);

  const handleBirdSelect = (bird: string) => {
    setSelectedBird(bird);
    setSearchQuery(bird);
    setSuggestions([]);
    Keyboard.dismiss();
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
    if (!selectedBird) {
      Alert.alert('Error', 'Please select a bird');
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    const { isNewSpecies: newSpeciesDetected, milestone } = addSighting({
      birdName: selectedBird,
      location,
      date,
      notes: notes || undefined,
      photoUrl: undefined,
      photoPath: photoUri || undefined,
      coordinates: locationCoords,
    });

    setSelectedBird('');
    setSearchQuery('');
    setNotes('');
    setDate(new Date());
    setPhotoUri(null);

    if (milestone) {
      setMilestoneCount(milestone);
      return;
    }

    setIsNewSpecies(newSpeciesDetected);
    setShowSuccess(true);

    if (newSpeciesDetected) {
      Vibration.vibrate([0, 150, 100, 150, 100, 300]);
    }

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

  const handleOutsidePress = () => {
    if (suggestions.length > 0) {
      setSuggestions([]);
    }
    if (placeSuggestions.length > 0) {
      setPlaceSuggestions([]);
    }
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: palette.cream }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <MilestoneCelebration
        visible={milestoneCount !== null}
        count={milestoneCount}
        onDismiss={() => setMilestoneCount(null)}
      />

      {showSuccess && (
        <Animated.View
          style={[
            styles.successPopup,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <HardShadow offset={4} borderRadius={radius.input}>
            <View
              style={[
                styles.successPopupContent,
                isNewSpecies && styles.newSpeciesPopupContent,
              ]}
            >
              <Ionicons
                name={isNewSpecies ? 'star' : 'checkmark-circle'}
                size={22}
                color="#fff"
              />
              <Text style={styles.successPopupText}>
                {isNewSpecies ? 'New species added to your dex!' : 'Sighting logged successfully!'}
              </Text>
            </View>
          </HardShadow>
        </Animated.View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 40 },
        ]}
        keyboardShouldPersistTaps="always"
        onScrollBeginDrag={handleOutsidePress}
      >
        <Pressable onPress={handleOutsidePress} android_disableSound={true}>
          <View style={styles.innerContainer}>
            <Text style={styles.title}>Add Sighting</Text>

            <View style={styles.form}>
              {/* Bird Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>BIRD</Text>
                <TextInput
                  ref={textInputRef}
                  style={[styles.input, selectedBird ? styles.inputDisplay : null]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="What'd you see?"
                  placeholderTextColor={palette.muted}
                  onBlur={() => setSuggestions([])}
                />
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

              {/* Date */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>DATE</Text>
                <Pressable
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
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
                    <Text style={styles.saveButtonText}>Save Sighting</Text>
                  </Pressable>
                </HardShadow>
              </View>
            </View>
          </View>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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

  // Input recipe applied directly. The font color/family are set so the
  // TextInput itself renders consistently across iOS/Android.
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

  // Location row: input flexes to fill, locate button sits to the right
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

  // Suggestions dropdown: 2px ink border, no soft shadow (clipped offset on
  // the bottom would interfere with z-stacking, so leave shadowless here).
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

  // Date button: same input recipe but row layout
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

  // Save button
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

  // Success popup
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

  // Photo
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
