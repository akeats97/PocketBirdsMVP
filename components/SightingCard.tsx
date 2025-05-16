import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Sighting } from '../app/types';

interface SightingCardProps {
  sighting: Sighting;
}

export default function SightingCard({ sighting }: SightingCardProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.card}>
      {sighting.photoUrl && (
        <Image 
          source={{ uri: sighting.photoUrl }} 
          style={styles.photo}
          resizeMode="cover"
        />
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.birdName}>{sighting.birdName}</Text>
          <Text style={styles.date}>{formatDate(sighting.date)}</Text>
        </View>
        
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={16} color="#666" />
          <Text style={styles.location}>{sighting.location}</Text>
        </View>

        {sighting.notes && (
          <Text style={styles.notes} numberOfLines={2}>
            {sighting.notes}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 200,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  birdName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  notes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
}); 