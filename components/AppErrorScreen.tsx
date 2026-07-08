import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';
import { palette, radius, recipes, space, type } from '../constants/Colors';
import { captureError } from '../config/sentry';
import { HardShadow } from './SightingCard';

// Branded fallback for a render error that escapes to the root, exported as the
// root layout's `ErrorBoundary` (N-2). Replaces expo-router's default error
// screen — a bare white screen in a release build. Voice per the PRD: cheeky
// about the app. Reports the error to Sentry (no-op in dev / without a DSN).
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    captureError(error);
  }, [error]);

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
      ]}
    >
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={palette.coral} />
        <Text style={styles.title}>Hang on, our binos fogged up.</Text>
        <Text style={styles.body}>
          Something went blurry on our end. We've made a note of it. Try that again.
        </Text>
      </View>
      <HardShadow style={styles.buttonShadow} borderRadius={radius.input}>
        <Pressable style={styles.button} onPress={() => retry()}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </HardShadow>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
    paddingHorizontal: space.xl,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  title: {
    ...type.h2,
    color: palette.ink,
    textAlign: 'center',
  },
  body: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
    maxWidth: 300,
  },
  buttonShadow: {
    alignSelf: 'stretch',
  },
  button: {
    ...recipes.buttonPrimary,
  },
  buttonText: {
    ...recipes.buttonPrimaryText,
  },
});
