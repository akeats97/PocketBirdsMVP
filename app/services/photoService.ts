import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { Coordinates } from '../types';

// Photos permission (Android: READ_MEDIA_IMAGES + ACCESS_MEDIA_LOCATION; iOS:
// photo library access). The system pickers themselves need NO permission;
// this exists so readPhotoCoordinates can resolve the picked photo's library
// asset and read its GPS. Requested proactively when the Add screen mounts and
// again just-in-time before the asset lookup; never blocks picking a photo.
export async function requestPhotoPermission(): Promise<boolean> {
  try {
    let { status } = await MediaLibrary.getPermissionsAsync(false, ['photo']);
    if (status !== 'granted') {
      status = (await MediaLibrary.requestPermissionsAsync(false, ['photo'])).status;
    }
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function pickImage(): Promise<ImagePicker.ImagePickerResult> {
  // Launch image picker. Both platforms use a system picker that works without
  // any permission, so a denied photos permission (see requestPhotoPermission)
  // never blocks picking, it only disables the photo-GPS read. We deliberately
  // DON'T crop (allowsEditing): the crop step re-encodes a new file that drops
  // the EXIF GPS on Android, which would break location-based species ranking.
  return await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    exif: true,
    quality: 0.7, // Compress the image
  });
}

function coordsFromExif(exif: Record<string, any> | null | undefined): Coordinates | null {
  if (!exif) return null;
  // expo-image-picker flattens GPS onto the exif object on Android; some iOS
  // payloads nest it under a "{GPS}" dictionary.
  const gps = exif['{GPS}'] ?? exif;
  const lat = gps.GPSLatitude ?? gps.Latitude;
  const lng = gps.GPSLongitude ?? gps.Longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (lat === 0 && lng === 0) return null;
  const latRef = gps.GPSLatitudeRef ?? gps.LatitudeRef;
  const lngRef = gps.GPSLongitudeRef ?? gps.LongitudeRef;
  return {
    latitude: latRef === 'S' ? -Math.abs(lat) : lat,
    longitude: lngRef === 'W' ? -Math.abs(lng) : lng,
    capturedAt: new Date(),
  };
}

// Best-effort read of where a picked photo was taken. The real path on BOTH
// platforms is the library-asset lookup: both system pickers strip GPS from the
// copy they hand over (Android's Photo Picker redacts location by design, and
// quality<1 re-encodes without GPS tags), so `asset.exif` is only a lucky hit.
// `asset.assetId` on Android comes from our patch-package patch on
// expo-image-picker (patches/expo-image-picker+16.1.4.patch), which maps Photo
// Picker URIs back to a media-store id (upstream returns null for those).
// Returns null when the photo carries no location (screenshot, download,
// camera location off, cloud-only picker item) or permission is denied;
// callers fall back to phone location.
export async function readPhotoCoordinates(
  asset: ImagePicker.ImagePickerAsset
): Promise<Coordinates | null> {
  const fromExif = coordsFromExif(asset.exif as any);
  console.log(
    '[photoService] photo coords: assetId =', asset.assetId ?? 'null',
    '| exif keys =', Object.keys(asset.exif ?? {}).filter(k => /gps|lat|lon/i.test(k)),
    '| exif branch =', fromExif ? 'hit' : 'miss'
  );
  if (fromExif) return fromExif;

  if (!asset.assetId) return null;
  try {
    if (!(await requestPhotoPermission())) return null;
    const info = await MediaLibrary.getAssetInfoAsync(asset.assetId);
    console.log('[photoService] getAssetInfoAsync location =', info.location ?? 'null');
    if (info.location) {
      return {
        latitude: info.location.latitude,
        longitude: info.location.longitude,
        capturedAt: new Date(),
      };
    }
  } catch (err) {
    console.log('[photoService] getAssetInfoAsync failed:', err);
  }
  return null;
}

export async function uploadPhoto(uri: string, sightingId: string): Promise<string> {
  try {
    // Get the file extension
    const extension = uri.split('.').pop();
    const filename = `${sightingId}.${extension}`;
    
    // Create a reference to the file location in Firebase Storage
    const storage = getStorage();
    const storageRef = ref(storage, `sightings/${filename}`);

    // Convert URI to blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload the file
    await uploadBytes(storageRef, blob);

    // Get the download URL
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
}

const photoService = {
  pickImage,
  uploadPhoto,
  readPhotoCoordinates,
  requestPhotoPermission
};

export default photoService; 