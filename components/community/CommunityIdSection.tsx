import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, palette, radius, space } from '../../constants/Colors';
import { Proposal } from '../../app/types';
import { HardShadow } from '../SightingCard';
import { ProposalCard } from './ProposalCard';

interface CommunityIdSectionProps {
  proposals: Proposal[];
  isOwner: boolean;
  /** Owner, or someone who follows the owner — may propose / hoot. */
  canPropose: boolean;
  onPropose: () => void;
  onShare: () => void;
  hasHootedProposal: (proposalId: string) => boolean;
  /** Optimistic hoot count for a proposal (see HootsContext.displayHootCount). */
  hootCountFor: (proposal: Proposal) => number;
  onToggleHoot: (proposalId: string) => void;
}

// The "What is it?" community-ID section, inserted between the meta/hoot block
// and the comments. Renders the empty state or the ranked leaderboard. The
// owner's Accept bar is NOT here — it pins above the comment composer (see the
// detail screen). Proposals arrive pre-ranked (hootCount desc, createdAt asc).
export function CommunityIdSection({
  proposals,
  isOwner,
  canPropose,
  onPropose,
  onShare,
  hasHootedProposal,
  hootCountFor,
  onToggleHoot,
}: CommunityIdSectionProps) {
  const count = proposals.length;
  const totalHoots = proposals.reduce((sum, p) => sum + hootCountFor(p), 0);

  return (
    <View>
      {/* Section header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>What is it?</Text>
        <Text style={styles.headerCount}>
          {count} {count === 1 ? 'proposal' : 'proposals'}
          {totalHoots > 0 ? ` · ${totalHoots} hoots` : ''}
        </Text>
      </View>

      {count === 0 ? (
        <View style={styles.body}>
          {/* Empty card */}
          <HardShadow offset={4} borderRadius={radius.card}>
            <View style={styles.emptyCard}>
              <View style={styles.qBadge}>
                <Text style={styles.qBadgeText}>?</Text>
              </View>
              <Text style={styles.emptyTitle}>No proposals yet.</Text>
              <Text style={styles.emptySub}>
                {isOwner
                  ? "Propose your best guess, or share it with someone who'd know."
                  : 'Help your friend identify their find!'}
              </Text>
            </View>
          </HardShadow>

          {/* Propose CTA (inline) */}
          {canPropose && (
            <View style={styles.ctaWrap}>
              <HardShadow offset={4} borderRadius={radius.input}>
                <Pressable
                  style={({ pressed }) => [styles.proposeBtn, pressed && { backgroundColor: palette.ink }]}
                  onPress={onPropose}
                >
                  <Ionicons name="add" size={17} color="#fff" />
                  <Text style={styles.proposeBtnText}>Propose an ID</Text>
                </Pressable>
              </HardShadow>
            </View>
          )}

          {/* Owner-only: share for ID help */}
          {isOwner && (
            <Pressable
              style={({ pressed }) => [styles.shareRow, pressed && { backgroundColor: palette.sunSoft }]}
              onPress={onShare}
            >
              <Ionicons name="share-social-outline" size={15} color={palette.inkSoft} />
              <Text style={styles.shareText}>Share with someone who&apos;d know</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View>
          {/* Instruction line */}
          <Text style={styles.instruction}>
            {isOwner
              ? 'Hoot the one you agree with, then lock it in.'
              : 'Hoot the proposal you think is right.'}
          </Text>

          {proposals.map((p, i) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              rank={i + 1}
              leader={i === 0}
              hooted={hasHootedProposal(p.id)}
              count={hootCountFor(p)}
              onToggleHoot={() => onToggleHoot(p.id)}
            />
          ))}

          {/* Propose a different bird (quiet) */}
          {canPropose && (
            <View style={styles.differentWrap}>
              <Pressable
                style={({ pressed }) => [styles.differentBar, pressed && { backgroundColor: palette.leafSoft }]}
                onPress={onPropose}
              >
                <Ionicons name="add" size={16} color={palette.ink} />
                <Text style={styles.differentText}>Propose a different bird</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  headerTitle: {
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.3,
  },
  headerCount: {
    fontFamily: font.mono,
    fontSize: 10.5,
    color: palette.muted,
    letterSpacing: 0.3,
  },

  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  emptyCard: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: palette.ink,
    padding: space.lg,
    alignItems: 'center',
    elevation: 0,
  },
  qBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  qBadgeText: {
    fontFamily: font.displayBlack,
    fontSize: 28,
    fontWeight: '800',
    color: palette.ink,
  },
  emptyTitle: {
    fontFamily: font.display,
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: font.body,
    fontSize: 13,
    color: palette.inkSoft,
    marginTop: 6,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 240,
  },

  ctaWrap: {
    marginTop: space.md,
  },
  proposeBtn: {
    backgroundColor: palette.leaf,
    borderRadius: radius.input,
    borderWidth: 2,
    borderColor: palette.ink,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  proposeBtnText: {
    fontFamily: font.display,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  shareRow: {
    marginTop: space.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.muted,
    borderRadius: radius.input,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareText: {
    fontFamily: font.display,
    fontSize: 13.5,
    fontWeight: '700',
    color: palette.inkSoft,
  },

  instruction: {
    fontFamily: font.body,
    fontSize: 12,
    color: palette.inkSoft,
    paddingHorizontal: space.lg,
    marginBottom: space.xs,
  },
  differentWrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  differentBar: {
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.input,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  differentText: {
    fontFamily: font.display,
    fontSize: 14.5,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.2,
  },
});
