import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import SightingCard from '../../components/SightingCard';
import { useSightings } from '../context/SightingsContext';

export default function LogScreen() {
  const { sightings } = useSightings();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Field Journal</Text>
      {sightings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No sightings yet</Text>
          <Text style={styles.emptyStateSubtext}>Add your first bird sighting!</Text>
        </View>
      ) : (
        <FlatList
          data={sightings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SightingCard sighting={item} />}
          contentContainerStyle={styles.listContent}
        />
      )}
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
  listContent: {
    paddingVertical: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
}); 