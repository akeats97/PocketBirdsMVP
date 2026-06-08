import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ResumableZoom,
  fitContainer,
  useImageResolution,
} from 'react-native-zoom-toolkit';
import { border, palette } from '../constants/Colors';
import { getPhotoUri } from './utils/photoViewer';

// Full-screen pinch-zoom photo viewer. This is a PUSHED expo-router route, not
// a React Native <Modal>: gestures inside an RN Modal render in a separate
// native window where gesture-handler misbehaves on Android + the new
// architecture (two hand-rolled zoom attempts failed there). As a normal Stack
// screen it renders inside the app-root GestureHandlerRootView, so the
// react-native-zoom-toolkit gestures work.
//
// The image URL is read from an in-memory hand-off (see ./utils/photoViewer),
// NOT a router param: expo-router URL-decodes params, which corrupts the `%2F`
// in Firebase Storage download URLs into `/` and 400s the image.
export default function PhotoViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Captured once on mount; set synchronously right before navigation.
  const [photoUri] = useState(() => getPhotoUri());

  // The toolkit can use the image's intrinsic resolution to size the child and
  // cap zoom at native resolution. Image.getSize can fail/hang on Android, so
  // we don't gate rendering on it — show the image immediately at a full-screen
  // "contain" fit and let the resolution sharpen things once it resolves.
  const { resolution } = useImageResolution(
    photoUri ? { uri: photoUri } : { uri: '' }
  );
  const size = resolution
    ? fitContainer(resolution.width / resolution.height, { width, height })
    : { width, height };

  return (
    <View style={styles.screen}>
      {photoUri && (
        <ResumableZoom maxScale={resolution ?? 6}>
          <Image
            source={{ uri: photoUri }}
            style={size}
            resizeMethod="scale"
            resizeMode="contain"
          />
        </ResumableZoom>
      )}

      <Pressable
        style={[styles.close, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <Ionicons name="close" size={28} color={palette.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  close: {
    position: 'absolute',
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
});
