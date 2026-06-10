import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, palette, radius, space } from '../../constants/Colors';
import { Proposal } from '../../app/types';
import { HardShadow } from '../SightingCard';
import { Avatar } from '../social/Avatar';
import { HootButton } from '../social/HootButton';

interface ProposalCardProps {
  proposal: Proposal;
  rank: number;
  leader: boolean;
  hooted: boolean;
  onToggleHoot: () => void;
}

// One ranked proposal in the "What is it?" leaderboard. The #1 card wears the
// sun-yellow FRONT-RUNNER ribbon and a deeper hard shadow. Species is the
// COMMON NAME ONLY — no Latin line, ever.
export function ProposalCard({ proposal, rank, leader, hooted, onToggleHoot }: ProposalCardProps) {
  const router = useRouter();
  const count = proposal.hootCount ?? 0;
  return (
    <View style={styles.wrap}>
      <HardShadow offset={leader ? 4 : 2} borderRadius={radius.card}>
        <View style={styles.card}>
          {leader && (
            <View style={styles.ribbon}>
              <Ionicons name="trophy" size={12} color={palette.ink} />
              <Text style={styles.ribbonText}>FRONT-RUNNER</Text>
            </View>
          )}
          <View style={styles.inner}>
            <View style={styles.topRow}>
              <View
                style={[
                  styles.rankChip,
                  { backgroundColor: leader ? palette.ink : palette.cream },
                ]}
              >
                <Text
                  style={[
                    styles.rankText,
                    { color: leader ? palette.cream : palette.inkSoft },
                  ]}
                >
                  {rank}
                </Text>
              </View>
              <View style={styles.nameBlock}>
                <Text style={[styles.species, { fontSize: leader ? 19 : 16 }]} numberOfLines={2}>
                  {proposal.species}
                </Text>
                {/* Proposer credit — tappable, links to their profile */}
                <Pressable
                  style={styles.byRow}
                  onPress={() => router.push(`/profile/${proposal.uid}`)}
                  hitSlop={6}
                >
                  <Avatar name={proposal.username} seed={proposal.uid} size={20} />
                  <Text style={styles.byText} numberOfLines={1}>
                    proposed by <Text style={styles.byName}>{proposal.username}</Text>
                  </Text>
                </Pressable>
              </View>
            </View>

            {proposal.note ? <Text style={styles.note}>{proposal.note}</Text> : null}

            <View style={styles.footer}>
              <Text style={styles.agree}>
                <Text style={styles.agreeNum}>{count}</Text> {count === 1 ? 'hoot' : 'hoots'} agree
              </Text>
              <HootButton hooted={hooted} count={count} onPress={onToggleHoot} size="sm" />
            </View>
          </View>
        </View>
      </HardShadow>
    </View>
  );
}

const NOTE_INDENT = 38;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: space.lg,
    marginVertical: space.sm,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: palette.ink,
    overflow: 'hidden',
    elevation: 0,
  },
  ribbon: {
    backgroundColor: palette.sun,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: palette.ink,
  },
  ribbonText: {
    fontFamily: font.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: 1.5,
  },
  inner: {
    padding: space.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  rankChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  species: {
    fontFamily: font.display,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  byRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  byText: {
    fontFamily: font.body,
    fontSize: 11.5,
    color: palette.inkSoft,
    flexShrink: 1,
  },
  byName: {
    color: palette.ink,
    fontFamily: font.bodyBold,
  },
  note: {
    fontFamily: font.body,
    fontSize: 12.5,
    color: palette.ink,
    lineHeight: 18,
    marginTop: 10,
    paddingLeft: NOTE_INDENT,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingLeft: NOTE_INDENT,
  },
  agree: {
    fontFamily: font.body,
    fontSize: 11.5,
    color: palette.inkSoft,
  },
  agreeNum: {
    color: palette.ink,
    fontFamily: font.bodyBold,
  },
});
