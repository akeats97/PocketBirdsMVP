import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FriendSighting } from '../app/types';

interface FriendSightingCardProps {
  sighting: FriendSighting;
}

export default function FriendSightingCard({ sighting }: FriendSightingCardProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.birdName}>{sighting.birdName}</Text>
        <Text style={styles.date}>{formatDate(sighting.date)}</Text>
      </View>
      
      <View style={styles.friendContainer}>
        <Ionicons name="person" size={16} color="#4A90E2" />
        <Text style={styles.friendName}>{sighting.friendName}</Text>
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
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
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
  friendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A90E2',
    marginLeft: 4,
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