import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { font, palette, radius, space } from '../../constants/Colors';
import { HardShadow } from '../SightingCard';
import { Avatar } from '../social/Avatar';
import { MysteryPhoto } from './MysteryPhoto';

interface ProposalAcceptedCelebrationProps {
  visible: boolean;
  species: string | null;
  proposerName: string;
  proposerUid: string;
  hootCount: number;
  /** The owner's unique-species count after this acceptance, for the Dex chip. */
  dexNumber?: number | null;
  photoUrl?: string;
  onDismiss: () => void;
}

// "Mystery solved" takeover after an owner accepts a community ID. Mirrors the
// tone of the new-species success moment. No Latin subtitle, ever.
export function ProposalAcceptedCelebration({
  visible,
  species,
  proposerName,
  proposerUid,
  hootCount,
  dexNumber,
  photoUrl,
  onDismiss,
}: ProposalAcceptedCelebrationProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View style={styles.cardWrap}>
          <HardShadow offset={6} borderRadius={radius.card}>
            <View style={styles.card}>
              {/* Resolved photo (or the mystery placeholder) + IDENTIFIED badge */}
              <View>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
                ) : (
                  <MysteryPhoto height={150} />
                )}
                <View style={styles.identifiedBadge}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                  <Text style={styles.identifiedText}>IDENTIFIED</Text>
                </View>
              </View>

              <View style={styles.body}>
                <Text style={styles.eyebrow}>MYSTERY SOLVED</Text>
                <Text style={styles.title}>It&apos;s a {species}!</Text>

                <View style={styles.creditRow}>
                  <Avatar name={proposerName} seed={proposerUid} size={26} />
                  <Text style={styles.creditText}>
                    Called by <Text style={styles.creditStrong}>{proposerName}</Text>, backed by{' '}
                    <Text style={styles.creditStrong}>
                      {hootCount} {hootCount === 1 ? 'hoot' : 'hoots'}
                    </Text>
                  </Text>
                </View>

                <View style={styles.dexChip}>
                  <Ionicons name="star" size={16} color={palette.ink} />
                  <Text style={styles.dexChipText}>
                    Added to your Dex{dexNumber ? ` · species #${dexNumber}` : ''}
                  </Text>
                </View>

                <Text style={styles.done}>Yay, congrats!</Text>
              </View>
            </View>
          </HardShadow>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,36,23,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrap: {
    width: '84%',
  },
  card: {
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.card,
    overflow: 'hidden',
    elevation: 0,
  },
  photo: {
    width: '100%',
    height: 150,
    backgroundColor: palette.skySoft,
  },
  identifiedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: palette.leaf,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  identifiedText: {
    fontFamily: font.bodyBold,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  body: {
    padding: space.xl,
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: font.mono,
    fontSize: 10,
    color: palette.inkSoft,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -1,
    lineHeight: 28,
    marginTop: 6,
    textAlign: 'center',
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  creditText: {
    fontFamily: font.body,
    fontSize: 12.5,
    color: palette.ink,
    flexShrink: 1,
  },
  creditStrong: {
    fontFamily: font.bodyBold,
    color: palette.ink,
  },
  dexChip: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    backgroundColor: palette.leafSoft,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.input,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  dexChipText: {
    fontFamily: font.display,
    fontSize: 14.5,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  done: {
    marginTop: 14,
    fontFamily: font.display,
    fontSize: 15,
    fontWeight: '700',
    color: palette.leaf,
  },
});
