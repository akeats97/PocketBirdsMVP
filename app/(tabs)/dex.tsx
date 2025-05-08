import { FontAwesome5 } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { birdNames } from '../../constants/birdNames';
import { useSightings } from '../context/SightingsContext';

export default function DexScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlySeen, setShowOnlySeen] = useState(false);
  const { sightings } = useSightings();
  const [stats, setStats] = useState({
    totalSightings: 0,
    uniqueSpecies: 0
  });

  // Create a map to count bird sightings and track last seen date
  const [birdData, setBirdData] = useState<{ 
    [key: string]: { 
      timesSeen: number;
      lastSeen: string; 
      seen: boolean;
    } 
  }>({});

  // Process sightings to get the counts and last seen dates
  useEffect(() => {
    const data: { [key: string]: { timesSeen: number; lastSeen: string; seen: boolean } } = {};
    
    // Initialize all birds as not seen
    birdNames.forEach(name => {
      data[name] = { 
        timesSeen: 0, 
        lastSeen: '', 
        seen: false 
      };
    });

    // Update with actual sightings data
    sightings.forEach(sighting => {
      const birdName = sighting.birdName;
      if (data[birdName]) {
        data[birdName].timesSeen += 1;
        data[birdName].seen = true;
        
        // Update last seen date if it's more recent
        const sightingDate = sighting.date.toISOString().split('T')[0];
        if (!data[birdName].lastSeen || sightingDate > data[birdName].lastSeen) {
          data[birdName].lastSeen = sightingDate;
        }
      }
    });

    setBirdData(data);
    
    // Calculate statistics
    const uniqueSpeciesSeen = Object.values(data).filter(bird => bird.seen).length;
    const totalSightingsCount = sightings.length;
    
    setStats({
      totalSightings: totalSightingsCount,
      uniqueSpecies: uniqueSpeciesSeen
    });
  }, [sightings]);

  // Convert bird data to array for FlatList
  const birdList = Object.keys(birdData).map(name => ({
    id: name,
    name,
    ...birdData[name]
  }));

  // Filter birds based on search and seen status
  const filteredBirds = birdList.filter(bird => {
    const matchesSearch = bird.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeen = !showOnlySeen || bird.seen;
    return matchesSearch && matchesSeen;
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not seen yet';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bird Dex</Text>
      
      {/* Stats Panel */}
      <View style={styles.statsPanel}>
        <View style={styles.statItem}>
          <FontAwesome5 name="eye" size={18} color="#4CAF50" style={styles.statIcon} />
          <View>
            <Text style={styles.statValue}>{stats.totalSightings}</Text>
            <Text style={styles.statLabel}>Total Sightings</Text>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.statItem}>
          <FontAwesome5 name="feather" size={18} color="#2196F3" style={styles.statIcon} />
          <View>
            <Text style={styles.statValue}>{stats.uniqueSpecies}</Text>
            <Text style={styles.statLabel}>Species Seen</Text>
          </View>
        </View>
      </View>
      
      <TextInput
        style={styles.searchBar}
        placeholder="Search birds..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <TouchableOpacity 
        style={styles.toggleContainer}
        onPress={() => setShowOnlySeen(!showOnlySeen)}
      >
        <View style={[styles.checkbox, showOnlySeen && styles.checkboxChecked]}>
          {showOnlySeen && <FontAwesome5 name="check" size={12} color="white" />}
        </View>
        <Text style={styles.toggleText}>Show only seen birds</Text>
      </TouchableOpacity>
      <FlatList
        data={filteredBirds}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.birdIcon}>
                <FontAwesome5 name="dove" size={18} color="#555" />
              </View>
              <Text style={styles.birdName}>{item.name}</Text>
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.cardText}>Times Seen: {item.timesSeen}</Text>
              <Text style={styles.cardText}>
                {item.lastSeen ? `Last Seen: ${formatDate(item.lastSeen)}` : 'Not seen yet'}
              </Text>
            </View>
          </View>
        )}
      />
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
  statsPanel: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: '#ddd',
  },
  searchBar: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 16,
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  birdIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  birdName: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardDetails: {
    marginLeft: 46,
  },
  cardText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
}); 