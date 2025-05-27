import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FriendSighting } from '../app/types';

interface FriendSightingCardProps {
  sighting: FriendSighting;
}

export default function FriendSightingCard({ sighting }: FriendSightingCardProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
        <TouchableOpacity onPress={() => setIsModalVisible(true)}>
          <Image 
            source={{ uri: sighting.photoUrl }} 
            style={styles.photo}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.birdNameContainer}>
            <Text style={styles.birdName}>{sighting.birdName}</Text>
            {sighting.photoUrl && (
              <Ionicons name="camera" size={16} color="#4CAF50" style={styles.cameraIcon} />
            )}
          </View>
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

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setIsModalVisible(false)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          
          {sighting.photoUrl && (
            <ScrollView
              style={styles.modalPhoto}
              contentContainerStyle={styles.modalPhotoContainer}
              minimumZoomScale={1}
              maximumZoomScale={3}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bouncesZoom={true}
            >
              <Image 
                source={{ uri: sighting.photoUrl }} 
                style={[styles.modalPhotoImage, { width: screenWidth, height: screenHeight }]}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        </View>
      </Modal>
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
  birdNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  birdName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cameraIcon: {
    marginLeft: 6,
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  modalPhoto: {
    flex: 1,
    width: '100%',
  },
  modalPhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPhotoImage: {
    flex: 1,
  },
}); 