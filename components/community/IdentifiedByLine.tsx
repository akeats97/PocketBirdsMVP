import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { font, palette } from '../../constants/Colors';

// Warm credit for a Mystery Bird resolved by a community proposal: "ID'd by
// @username", the name tapping through to the identifier's profile. Reads as a
// thank-you to the helper, not a correction of the owner. Renders nothing unless
// the sighting carries a denormalized identifier. See WORK_QUEUE Q-9.
export function IdentifiedByLine({ uid, username }: { uid?: string; username?: string }) {
  const router = useRouter();
  if (!username) return null;
  return (
    <View style={styles.row}>
      <Ionicons name="people" size={12} color={palette.leaf} />
      <Text style={styles.text}>
        {"ID'd by "}
        <Text
          style={styles.name}
          onPress={uid ? () => router.push(`/profile/${uid}`) : undefined}
        >
          @{username}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  text: {
    fontFamily: font.body,
    fontSize: 12,
    color: palette.muted,
  },
  name: {
    fontFamily: font.bodyBold,
    color: palette.leaf,
  },
});
