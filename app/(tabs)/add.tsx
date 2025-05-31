import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { birdNames } from '../../constants/birdNames';
import { useSightings } from '../context/SightingsContext';
import { pickImage, uploadPhoto } from '../services/photoService';

export default function AddSightingScreen() {
  const navigation = useNavigation();
  const { addSighting, lastLocation } = useSightings();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedBird, setSelectedBird] = useState('');
  const [location, setLocation] = useState(lastLocation);
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

  // Update location when lastLocation changes
  useEffect(() => {
    setLocation(lastLocation);
  }, [lastLocation]);

  // Filter bird names based on search query
  useEffect(() => {
    if (searchQuery.length > 0 && searchQuery !== selectedBird) {
      const filtered = birdNames
        .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()));
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
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

  const handleSave = async () => {
    if (!selectedBird) {
      Alert.alert('Error', 'Please select a bird');
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    let photoUrl;

    if (photoUri) {
      try {
        photoUrl = await uploadPhoto(photoUri, Date.now().toString());
      } catch (error) {
        Alert.alert('Error', 'Failed to upload photo');
        return;
      }
    }

    const newSpeciesDetected = addSighting({
      birdName: selectedBird,
      location,
      date,
      notes: notes || undefined,
      photoUrl,
      photoPath: photoUri || undefined,
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
                <TextInput
                  ref={locationInputRef}
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Where did you see it?"
                  placeholderTextColor="#999"
                />
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