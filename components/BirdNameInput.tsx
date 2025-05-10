import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, View, FlatList, TouchableOpacity, Text } from 'react-native';
import { birdNames } from '../constants/birdNames';

interface BirdNameInputProps {
  onBirdSelect: (birdName: string) => void;
}

export default function BirdNameInput({ onBirdSelect }: BirdNameInputProps) {
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (searchText.length > 0) {
      const filteredBirds = birdNames.filter(name =>
        name.toLowerCase().includes(searchText.toLowerCase())
      );
      setSuggestions(filteredBirds.slice(0, 5)); // Show top 5 matches
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchText]);

  const handleSelect = (birdName: string) => {
    setSearchText(birdName);
    setShowSuggestions(false);
    onBirdSelect(birdName);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search for a bird..."
        placeholderTextColor="#666"
      />
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    maxHeight: 200,
    zIndex: 1000,
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionText: {
    fontSize: 16,
  },
}); 