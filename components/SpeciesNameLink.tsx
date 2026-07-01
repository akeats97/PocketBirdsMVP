import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { palette } from '../constants/Colors';
import { isReportEntry } from '../constants/reportTypes';
import { isCustomSpecies } from '../constants/customSpecies';
import { isUnknownEntry } from '../constants/unknownBird';

interface Props {
  name: string;
  /** The caller's headline text style (h2 on the detail screen, h3 on cards). */
  textStyle: any;
  numberOfLines?: number;
  glyphSize?: number;
}

/**
 * The bird name as a link to its field-guide page. A tap always means "open the
 * species page" — never the surrounding card's comment thread — so we build one
 * consistent expectation everywhere the name appears.
 *
 * Only real IOC species have a guide page. Mystery Birds, Reports, and custom
 * entries have nothing to show: their name stays its own tap target (so it still
 * doesn't fall through to the card tap) but no-ops, and shows no chevron so it
 * doesn't look tappable.
 */
export function SpeciesNameLink({ name, textStyle, numberOfLines, glyphSize = 15 }: Props) {
  const router = useRouter();
  const hasGuide = !isUnknownEntry(name) && !isReportEntry(name) && !isCustomSpecies(name);

  const open = () => router.push({ pathname: '/species/[name]', params: { name } });

  return (
    <Pressable
      onPress={hasGuide ? open : () => {}}
      hitSlop={4}
      style={({ pressed }) => (pressed && hasGuide ? { opacity: 0.6 } : null)}
    >
      <Text style={textStyle} numberOfLines={numberOfLines}>
        {name}
        {hasGuide && (
          <Text>
            {'  '}
            <Ionicons name="chevron-forward" size={glyphSize} color={palette.leaf} />
          </Text>
        )}
      </Text>
    </Pressable>
  );
}
