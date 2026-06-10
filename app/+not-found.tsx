import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { palette, space, type } from '../constants/Colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen does not exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: palette.cream,
  },
  title: {
    ...type.h2,
    color: palette.ink,
    textAlign: 'center',
  },
  link: {
    marginTop: space.lg,
    paddingVertical: space.md,
  },
  linkText: {
    ...type.body,
    color: palette.leaf,
    fontWeight: '700',
  },
});
