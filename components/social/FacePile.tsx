import React from 'react';
import { Text, View } from 'react-native';
import { font, palette } from '../../constants/Colors';
import { Avatar } from './Avatar';

interface Person {
  name: string;
  seed: string;
}

interface FacePileProps {
  people: Person[];
  /** Max faces to show before collapsing the rest into a +K chip. */
  max?: number;
  /** Side length of each avatar in px. */
  size?: number;
}

const OVERLAP = -9;

// Overlapping row of avatars with a trailing "+K" ink chip when there are more
// people than `max`. Used in the card engagement summary, hoot list, and the
// sighting detail header.
export function FacePile({ people, max = 4, size = 26 }: FacePileProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <View
          key={p.seed}
          style={{ marginLeft: i === 0 ? 0 : OVERLAP, zIndex: shown.length - i }}
        >
          <Avatar name={p.name} seed={p.seed} size={size} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={{
            marginLeft: OVERLAP,
            width: size,
            height: size,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: palette.ink,
            backgroundColor: palette.ink,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <Text
            style={{
              fontFamily: font.mono,
              color: palette.cream,
              fontSize: size * 0.34,
            }}
          >
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
}
