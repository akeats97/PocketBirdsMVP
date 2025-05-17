import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);

  // Update location when lastLocation changes
  useEffect(() => {
    setLocation(lastLocation);
  }, [lastLocation]);

  // Filter bird names based on search query
  useEffect(() => {
    if (searchQuery.length > 0 && searchQuery !== selectedBird) {
      const filtered = birdNames
        .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 5);
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

    addSighting({
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

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
    }, 2000);
  };

  return (
    <View style={styles.container}>
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
          />
          {suggestions.length > 0 && (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.suggestionButton,
                    pressed && { backgroundColor: '#f0f0f0' }
                  ]}
                  onPress={() => handleBirdSelect(item)}
                >
                  <Text style={styles.suggestionButtonText}>{item}</Text>
                </Pressable>
              )}
              keyboardShouldPersistTaps="always"
            />
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

        {showSuccess && (
          <View style={styles.successMessage}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.successText}>Sighting logged successfully!</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  form: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  notesInput: {
    height: 60,
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
    borderRadius: 8,
    marginTop: 4,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  successText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
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