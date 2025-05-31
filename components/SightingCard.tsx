import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSightings } from '../app/context/SightingsContext';
import { Sighting } from '../app/types';

interface SightingCardProps {
  sighting: Sighting;
}

export default function SightingCard({ sighting }: SightingCardProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const { deleteSighting } = useSightings();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleLongPress = () => {
    setIsDeleteModalVisible(true);
  };

  const handleDelete = async () => {
    try {
      const result = await deleteSighting(sighting.id);
      if (result.success) {
        setIsDeleteModalVisible(false);
        if (result.wasLastOfSpecies) {
          Alert.alert(
            'Species Removed',
            `${sighting.birdName} has been removed from your species list as this was your only sighting.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        // Log error for debugging but don't show user-facing alert
        console.error('Failed to delete sighting - deleteSighting returned false');
        setIsDeleteModalVisible(false);
      }
    } catch (error) {
      // Log error for debugging but don't show user-facing alert
      console.error('Error in handleDelete:', error);
      setIsDeleteModalVisible(false);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card}
      onLongPress={handleLongPress}
      delayLongPress={500}
      activeOpacity={0.9}
    >
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

      {/* Full-screen photo modal */}
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

      {/* Delete confirmation modal */}
      <Modal
        visible={isDeleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalContainer}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteIconContainer}>
              <Ionicons name="trash" size={48} color="#FF4444" />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Sighting?</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this sighting of {sighting.birdName}?
            </Text>
            <Text style={styles.deleteModalSubtext}>
              This action cannot be undone.
            </Text>
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setIsDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
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
  cameraIcon: {
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalPhoto: {
    width: '100%',
    height: '100%',
  },
  modalPhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPhotoImage: {
    flex: 1,
  },
  deleteModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  deleteIconContainer: {
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  deleteModalSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  deleteButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FF4444',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
}); 