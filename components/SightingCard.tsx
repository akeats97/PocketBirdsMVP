import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSightings } from '../app/context/SightingsContext';
import { setPhotoUri } from '../app/utils/photoViewer';
import { Sighting } from '../app/types';
import { border, palette, radius, recipes, space, type } from '../constants/Colors';
import { isMysteryBird } from '../constants/unknownBird';
import { NeedsIdPill } from './community/NeedsIdPill';

interface SightingCardProps {
  sighting: Sighting;
  isNewSpecies?: boolean;
}

export default function SightingCard({ sighting, isNewSpecies }: SightingCardProps) {
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const { deleteSighting } = useSightings();
  const router = useRouter();

  const photoSource = sighting.photoUrl || sighting.photoPath;

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
        console.error('Failed to delete sighting - deleteSighting returned false');
        setIsDeleteModalVisible(false);
      }
    } catch (error) {
      console.error('Error in handleDelete:', error);
      setIsDeleteModalVisible(false);
    }
  };

  return (
    <HardShadow style={styles.shadowWrap}>
      <Pressable
        style={styles.card}
        onLongPress={handleLongPress}
        delayLongPress={500}
        android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
      >
        {/* TODO: IUCN conservation status strip goes here once Wikidata dump exists.
            See CLAUDE.md "Pending Design Work" and design_handoff_pocket_dex/wikidata-dump.md. */}

        {photoSource && (
          <Pressable onPress={() => { setPhotoUri(photoSource); router.push('/photo'); }}>
            <Image
              source={{ uri: photoSource }}
              style={styles.photo}
              resizeMode="cover"
            />
          </Pressable>
        )}

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.nameBlock}>
              <Text style={styles.birdName} numberOfLines={2}>{sighting.birdName}</Text>
            </View>

            {/* TODO (global-first): when sighting.globalFirst is true, show a
                special "FIRST ON POCKET BIRDS" pill here (design TBD). The flag
                already exists on the sighting; only the pill UI is pending.
                See WORK_QUEUE Q-3. */}
            {isNewSpecies && (
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
                  <Ionicons
                    name="location"
                    size={12}
                    color={sighting.coordinates ? palette.leaf : palette.muted}
                  />
                  <Text style={styles.metaText} numberOfLines={1}>{sighting.location}</Text>
                </View>
                <Text style={styles.metaDivider}>·</Text>
              </>
            ) : null}
            <Text style={styles.metaText}>{formatRelativeDate(sighting.date)}</Text>
          </View>

          {isMysteryBird(sighting) && (
            <Pressable
              style={({ pressed }) => [styles.needsIdRow, pressed && { opacity: 0.6 }]}
              onPress={() => router.push(`/sighting/${sighting.id}`)}
              hitSlop={6}
            >
              <NeedsIdPill />
              <Text style={styles.needsIdText} numberOfLines={1}>
                {(sighting.proposalCount ?? 0) > 0
                  ? sighting.leadingProposal
                    ? `Front-runner: ${sighting.leadingProposal.species}`
                    : `${sighting.proposalCount} ${sighting.proposalCount === 1 ? 'proposal' : 'proposals'}`
                  : 'Tap to get an ID'}
              </Text>
            </Pressable>
          )}

          {sighting.notes && (
            <Text style={styles.notes} numberOfLines={2}>{sighting.notes}</Text>
          )}
        </View>
      </Pressable>

      {/* Delete confirmation modal */}
      <Modal
        visible={isDeleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalContainer}>
          <HardShadow offset={4} borderRadius={radius.card}>
            <View style={styles.deleteModalContent}>
              <View style={styles.deleteIconContainer}>
                <Ionicons name="trash" size={40} color={palette.coral} />
              </View>
              <Text style={styles.deleteModalTitle}>Delete sighting?</Text>
              <Text style={styles.deleteModalText}>
                Remove this sighting of {sighting.birdName}?
              </Text>
              <Text style={styles.deleteModalSubtext}>
                This can&apos;t be undone.
              </Text>

              <View style={styles.deleteModalButtons}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setIsDeleteModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={handleDelete}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </HardShadow>
        </View>
      </Modal>
    </HardShadow>
  );
}

/**
 * Hard offset shadow. RN's shadow props can't render a hard, no-blur shadow,
 * so we stack an absolutely-positioned ink rectangle one layer below the
 * content. Reserve room for the offset with marginRight + marginBottom.
 */
export function HardShadow({
  children,
  style,
  offset = 4,
  borderRadius = radius.card,
}: {
  children: React.ReactNode;
  style?: any;
  offset?: number;
  borderRadius?: number;
}) {
  return (
    <View style={style}>
      <View style={{ marginRight: offset, marginBottom: offset }}>
        <View
          style={{
            position: 'absolute',
            top: offset,
            left: offset,
            right: -offset,
            bottom: -offset,
            backgroundColor: palette.ink,
            borderRadius,
          }}
          pointerEvents="none"
        />
        {children}
      </View>
    </View>
  );
}

function formatRelativeDate(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    backgroundColor: palette.leafSoft,
  },
  body: {
    padding: space.lg,
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

  // "Needs ID" cue for Mystery Birds (denormalized fields — no listener).
  needsIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  needsIdText: {
    ...type.bodyS,
    color: palette.inkSoft,
    fontWeight: '500',
    flexShrink: 1,
  },

  // Delete confirmation modal
  deleteModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(26, 36, 23, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
  },
  deleteModalContent: {
    ...recipes.card,
    padding: space.xl,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  deleteIconContainer: {
    marginBottom: space.md,
  },
  deleteModalTitle: {
    ...type.h2,
    color: palette.ink,
    marginBottom: space.xs,
  },
  deleteModalText: {
    ...type.bodyL,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: space.xs,
  },
  deleteModalSubtext: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
    marginBottom: space.xl,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: space.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.input,
    backgroundColor: palette.cream,
    ...border.thick,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: palette.ink,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.input,
    backgroundColor: palette.coral,
    ...border.thick,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: -0.3,
  },
});
