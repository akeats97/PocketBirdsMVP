import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { birdNamesAlpha, birdNamesAlphaLower } from '../../constants/birdNamesLower';
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
  const textInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);
  const locationInputRef = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // Handle keyboard appearance
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Find the currently focused input
        const focusedInput = Platform.select({
          ios: textInputRef.current?.isFocused() ? textInputRef.current :
               notesInputRef.current?.isFocused() ? notesInputRef.current :
               locationInputRef.current?.isFocused() ? locationInputRef.current : null,
          android: textInputRef.current?.isFocused() ? textInputRef.current :
                  notesInputRef.current?.isFocused() ? notesInputRef.current :
                  locationInputRef.current?.isFocused() ? locationInputRef.current : null
        });

        if (focusedInput) {
          // Add a small delay to ensure the keyboard is fully shown
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
    // User is editing — clear stale inherited coords. New coords will get
    // attached only if they tap a suggestion or the locate button.
    setLocationCoords(undefined);
    setShouldAutocompleteLocation(true);
  };

  const handleLocateTap = async () => {
    let granted = await hasLocationPermission();
    if (!granted) granted = await requestLocationPermission();
    if (!granted) return;
    const result = await getCurrentLocationWithLabel();
    if (!result) return;
    setShouldAutocompleteLocation(false);
    setPlaceSuggestions([]);
    setLocation(result.label || location);
    setLocationCoords(result.coordinates);
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
      // Fall back to the suggestion's description if details fetch fails.
      setLocation(suggestion.description);
      setLocationCoords(undefined);
    }
  };

  // Filter bird names based on search query (debounced 100ms to coalesce fast
  // typing). Rank: prefix > word-start > substring. Cap to 20.
  // Uses pre-computed lowercase array to avoid string allocations in the loop.
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

      // Iterate alphabetically-sorted names so each tier collects matches in
      // alphabetical order naturally — no per-keystroke sort needed.
      for (let i = 0; i < birdNamesAlpha.length; i++) {
        const lower = birdNamesAlphaLower[i];
        if (lower.startsWith(q)) {
          if (tier0.length < CAP) tier0.push(birdNamesAlpha[i]);
        } else if (tier0.length < CAP) {
          // Only bother checking lower tiers if tier 0 still needs fillers.
          if (lower.includes(qSpace) || lower.includes(qDash)) {
            if (tier1.length < CAP) tier1.push(birdNamesAlpha[i]);
          } else if (lower.includes(q)) {
            if (tier2.length < CAP) tier2.push(birdNamesAlpha[i]);
          }
        }
        // Early exit: once tier 0 is full, no point scanning the rest.
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

    // Save locally first. If a photo was picked, just store its local URI as
    // photoPath. The sync layer uploads to Firebase Storage when online and
    // populates photoUrl. This way offline saves don't get lost.
    const newSpeciesDetected = addSighting({
      birdName: selectedBird,
      location,
      date,
      notes: notes || undefined,
      photoUrl: undefined,
      photoPath: photoUri || undefined,
      coordinates: locationCoords,
    });

    // Reset form
    setSelectedBird('');
    setSearchQuery('');
    setNotes('');
    setDate(new Date());
    setPhotoUri(null);

    // Set whether this is a new species and show success popup with animation
    setIsNewSpecies(newSpeciesDetected);
    setShowSuccess(true);
    
    // Trigger a gentle vibration if it's a new species
    if (newSpeciesDetected) {
      // Celebratory vibration pattern: short-pause-short-pause-longer
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
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {/* Success Popup */}
      {showSuccess && (
        <Animated.View 
          style={[
            styles.successPopup,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={[
            styles.successPopupContent,
            isNewSpecies && styles.newSpeciesPopupContent
          ]}>
            <Ionicons 
              name={isNewSpecies ? "star" : "checkmark-circle"} 
              size={24} 
              color={isNewSpecies ? "#FFD700" : "#4CAF50"} 
            />
            <Text style={[
              styles.successPopupText,
              isNewSpecies && styles.newSpeciesPopupText
            ]}>
              {isNewSpecies ? "New species found! 🎉" : "Sighting logged successfully!"}
            </Text>
          </View>
        </Animated.View>
      )}

      <Pressable 
        style={{ flex: 1 }} 
        onPress={handleOutsidePress}
        android_disableSound={true}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 40 }
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.innerContainer}>
            <Text style={styles.title}>Add Sighting</Text>
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Bird Name</Text>
                <TextInput
                  ref={textInputRef}
                  style={styles.input}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search for a bird..."
                  placeholderTextColor="#999"
                  onBlur={() => setSuggestions([])}
                />
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView 
                      style={styles.suggestionsScrollView}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                    >
                      {suggestions.map((item) => (
                        <Pressable
                          key={item}
                          style={({ pressed }) => [
                            styles.suggestionButton,
                            pressed && { backgroundColor: '#f0f0f0' }
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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Date</Text>
                <Pressable 
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>{date.toLocaleDateString()}</Text>
                  <Ionicons name="calendar" size={20} color="#666" />
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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Location</Text>
                <View style={styles.locationInputWrapper}>
                  <TextInput
                    ref={locationInputRef}
                    style={[styles.input, styles.locationInput]}
                    value={location}
                    onChangeText={handleLocationChange}
                    placeholder="Where did you see it?"
                    placeholderTextColor="#999"
                    onBlur={() => setPlaceSuggestions([])}
                  />
                  <TouchableOpacity
                    style={styles.locateButton}
                    onPress={handleLocateTap}
                    accessibilityLabel="Use my current location"
                  >
                    <Ionicons name="locate" size={22} color="#4A90E2" />
                  </TouchableOpacity>
                </View>
                {placeSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView
                      style={styles.suggestionsScrollView}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                    >
                      {placeSuggestions.map((s) => (
                        <Pressable
                          key={s.placeId}
                          style={({ pressed }) => [
                            styles.suggestionButton,
                            pressed && { backgroundColor: '#f0f0f0' }
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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Photo</Text>
                <TouchableOpacity 
                  style={[styles.photoButton, { height: photoUri ? 200 : 80 }]} 
                  onPress={handleSelectPhoto}
                >
                  {photoUri ? (
                    <Image 
                      source={{ uri: photoUri }} 
                      style={styles.photoPreview}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="camera" size={24} color="#666" />
                      <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  ref={notesInputRef}
                  style={[styles.input, styles.notesInput]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any additional notes..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={2}
                />
              </View>

              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Sighting</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    padding: 20,
    paddingBottom: 40, // Add extra padding at the bottom
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  notesInput: {
    height: 80, // Made taller for better usability
    textAlignVertical: 'top',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginTop: 4,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionsScrollView: {
    maxHeight: 200,
  },
  suggestionButton: {
    width: '100%',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  suggestionButtonText: {
    fontSize: 16,
    color: '#333',
  },
  suggestionSecondaryText: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  locationInputWrapper: {
    position: 'relative',
  },
  locationInput: {
    paddingRight: 44,
  },
  locateButton: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successPopup: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 10,
  },
  successPopupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  newSpeciesPopupContent: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
  },
  successPopupText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  newSpeciesPopupText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  photoButton: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
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
    backgroundColor: '#f5f5f5',
  },
  photoPlaceholderText: {
    marginTop: 4,
    color: '#666',
    fontSize: 14,
  },
}); 