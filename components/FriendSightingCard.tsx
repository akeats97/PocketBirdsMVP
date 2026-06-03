import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FriendSighting } from '../app/types';
import { border, palette, radius, recipes, space, type } from '../constants/Colors';
import { HardShadow } from './SightingCard';

interface FriendSightingCardProps {
  sighting: FriendSighting;
  isFirstSighting?: boolean;
}

function formatRelativeDate(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function FriendSightingCard({ sighting, isFirstSighting }: FriendSightingCardProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  return (
    <HardShadow style={styles.shadowWrap}>
      <View style={styles.card}>
        {sighting.photoUrl && (
          <Pressable onPress={() => setIsModalVisible(true)}>
            <Image
              source={{ uri: sighting.photoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          </Pressable>
        )}

        <View style={styles.body}>
          {/* Friend tag */}
          <View style={styles.friendTagRow}>
            <View style={styles.friendTag}>
              <Ionicons name="person" size={10} color={palette.ink} />
              <Text style={styles.friendTagText} numberOfLines={1}>
                {sighting.friendName.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.headerRow}>
            <View style={styles.nameBlock}>
              <Text style={styles.birdName} numberOfLines={2}>{sighting.birdName}</Text>
            </View>

            {isFirstSighting && (
              <View style={recipes.liferBadge}>
                <Ionicons name="star" size={9} color="#fff" />
                <Text style={recipes.liferBadgeText}>1ST</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            {sighting.location ? (
              <>
                <View style={styles.metaItem}>
                  <Ionicons name="location" size={12} color={palette.muted} />
                  <Text style={styles.metaText} numberOfLines={1}>{sighting.location}</Text>
                </View>
                <Text style={styles.metaDivider}>·</Text>
              </>
            ) : null}
            <Text style={styles.metaText}>{formatRelativeDate(sighting.date)}</Text>
          </View>

          {sighting.notes && (
            <Text style={styles.notes} numberOfLines={2}>{sighting.notes}</Text>
          )}
        </View>
      </View>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Pressable
            style={styles.modalCloseButton}
            onPress={() => setIsModalVisible(false)}
          >
            <Ionicons name="close" size={28} color={palette.ink} />
          </Pressable>

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
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginHorizontal: space.lg,
    marginVertical: space.sm,
  },
  card: {
    ...recipes.card,
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: palette.skySoft,
  },
  body: {
    padding: space.lg,
  },

  // Friend tag — sky-blue accent identifying who logged it
  friendTagRow: {
    flexDirection: 'row',
    marginBottom: space.sm,
  },
  friendTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.skySoft,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.ink,
    maxWidth: '100%',
  },
  friendTagText: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 10,
    color: palette.ink,
    letterSpacing: 1.2,
    fontWeight: '700',
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  birdName: {
    ...type.h3,
    color: palette.ink,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  metaText: {
    ...type.bodyS,
    color: palette.inkSoft,
    fontWeight: '500',
  },
  metaDivider: {
    color: palette.muted,
  },
  notes: {
    ...type.body,
    color: palette.inkSoft,
    marginTop: space.sm,
    fontStyle: 'italic',
  },

  // Photo zoom modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.cream,
    ...border.thick,
    justifyContent: 'center',
    alignItems: 'center',
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
});
