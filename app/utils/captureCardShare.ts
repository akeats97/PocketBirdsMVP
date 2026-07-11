// Snapshot the on-screen ShareCard to a PNG, then either hand it to the OS share
// sheet (expo-sharing) or save it to the camera roll (expo-media-library). Both
// are native modules added for the share feature.

import { Component } from 'react';
import { Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

// captureRef takes a ref OR the hosting view. We pass the ShareCard's ref.
type CaptureTarget = number | Component<any, any> | null | undefined;

async function snapshot(target: CaptureTarget): Promise<string> {
  // captureRef snapshots the native view at the device's pixel density, so on a
  // retina screen the PNG is already 2-3x the layout size.
  return captureRef(target as any, { format: 'png', quality: 1, result: 'tmpfile' });
}

export async function shareCardImage(target: CaptureTarget): Promise<void> {
  try {
    const uri = await snapshot(target);
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', "This device can't open the share sheet.");
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share sighting',
      UTI: 'public.png',
    });
  } catch (e) {
    console.error('[shareCard] share failed:', e);
    Alert.alert('Could not share', 'Something went wrong rendering the card. Please try again.');
  }
}

export async function saveCardImage(target: CaptureTarget): Promise<void> {
  try {
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos access needed', 'Allow photo access to save the card to your camera roll.');
      return;
    }
    const uri = await snapshot(target);
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert('Saved', 'Card saved to your camera roll.');
  } catch (e) {
    console.error('[shareCard] save failed:', e);
    Alert.alert('Could not save', 'Something went wrong saving the card. Please try again.');
  }
}
