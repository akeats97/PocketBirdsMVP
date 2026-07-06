import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { getDownloadURL, getStorage, putFile, ref } from '@react-native-firebase/storage';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { Image as RNImage } from 'react-native';
import { gpsFromJpegFile } from '../utils/exifGps';
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

// EXIF GPS values arrive in wildly different shapes depending on platform and
// how the native side read them: a decimal-degrees number, a decimal string,
// or Android ExifInterface's raw DMS rational string ("43/1,39/1,3072/100").
// Android's native export can also collapse the DMS rational to a useless 0.0
// (getAttributeDouble can't parse 3-component rationals), which must read as
// "no value", not the Gulf of Guinea.
function exifCoordToDecimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parts = value.split(',').map(part => {
    const [num, den] = part.split('/');
    const n = parseFloat(num);
    const d = den === undefined ? 1 : parseFloat(den);
    return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : NaN;
  });
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 1) return parts[0]; // decimal degrees
  if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600; // DMS
  return null;
}

function coordsFromExif(exif: Record<string, any> | null | undefined): Coordinates | null {
  if (!exif) return null;
  // expo-image-picker flattens GPS onto the exif object on Android; some iOS
  // payloads nest it under a "{GPS}" dictionary.
  const gps = exif['{GPS}'] ?? exif;
  const lat = exifCoordToDecimal(gps.GPSLatitude ?? gps.Latitude);
  const lng = exifCoordToDecimal(gps.GPSLongitude ?? gps.Longitude);
  if (lat === null || lng === null) return null;
  // 0,0 is overwhelmingly "the reader defaulted", not a real fix.
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
// EXIF DateTimeOriginal is "YYYY:MM:DD HH:MM:SS" in the device's local time.
function parseExifDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
  return isNaN(d.getTime()) ? null : d;
}

// Same photo, ignoring rotation: picker dims are post-rotation, MediaStore's
// aren't always, so compare as an unordered pair.
function dimsMatch(
  a: { width: number; height: number },
  b: { width: number; height: number }
): boolean {
  if (!a.width || !a.height || !b.width || !b.height) return false;
  return (
    (a.width === b.width && a.height === b.height) ||
    (a.width === b.height && a.height === b.width)
  );
}

// Locate the picked photo's ORIGINAL library asset when the picker hands back
// no usable asset id (cloud-provider picker items). The provider renames files
// (e.g. "1000026869.jpg"), so filename equality is only one signal; capture
// time + pixel dimensions identify the photo regardless of naming.
async function findLibraryAssetMatch(
  fileName: string,
  takenAt: Date | null,
  dims: { width: number; height: number }
): Promise<MediaLibrary.Asset | null> {
  const windowMs = 26 * 60 * 60 * 1000;
  const page = await MediaLibrary.getAssetsAsync({
    mediaType: 'photo',
    first: 200,
    sortBy: [['creationTime', false]],
    ...(takenAt
      ? {
          createdAfter: takenAt.getTime() - windowMs,
          createdBefore: takenAt.getTime() + windowMs,
        }
      : {}),
  });
  console.log(
    '[photoService] library window scan:', page.assets.length, 'assets',
    takenAt ? `around ${takenAt.toISOString()}` : '(no capture time, newest first)'
  );
  const target = fileName.toLowerCase();
  const byName = page.assets.filter(a => a.filename?.toLowerCase() === target);
  if (byName.length > 0) {
    if (!takenAt || byName.length === 1) return byName[0];
    return byName.reduce((best, a) =>
      Math.abs(a.creationTime - takenAt.getTime()) < Math.abs(best.creationTime - takenAt.getTime())
        ? a
        : best
    );
  }
  // No filename match; fall back to capture time + dimensions. Only safe when
  // we actually have a capture time to anchor on.
  if (!takenAt) return null;
  const byFingerprint = page.assets
    .filter(a => dimsMatch(a, dims))
    .sort(
      (a, b) =>
        Math.abs(a.creationTime - takenAt.getTime()) - Math.abs(b.creationTime - takenAt.getTime())
    );
  // Camera timestamps and MediaStore DATE_TAKEN agree to the second; allow a
  // couple of minutes for timezone-less EXIF weirdness, no more.
  if (byFingerprint.length > 0) {
    const best = byFingerprint[0];
    if (Math.abs(best.creationTime - takenAt.getTime()) <= 2 * 60 * 1000) return best;
  }
  return null;
}

// Cloud-provider picker items are often named "<numeric id>.jpg". Sometimes
// that number IS the local media-store id, so probe it, but only trust the
// result if the asset corroborates (capture time or dimensions), since a
// foreign cloud id could collide with an unrelated local asset.
async function probeNumericFilenameAsId(
  fileName: string,
  takenAt: Date | null,
  dims: { width: number; height: number }
): Promise<MediaLibrary.AssetInfo | null> {
  const m = fileName.match(/^(\d{1,19})\.\w+$/);
  if (!m) return null;
  try {
    const info = await MediaLibrary.getAssetInfoAsync(m[1]);
    if (!info) return null;
    const timeOk =
      takenAt !== null && Math.abs(info.creationTime - takenAt.getTime()) <= 48 * 60 * 60 * 1000;
    const dimsOk = dimsMatch(info, dims);
    console.log(
      '[photoService] numeric-id probe:', m[1],
      '| found asset', info.filename,
      '| timeOk =', timeOk, '| dimsOk =', dimsOk
    );
    return timeOk || dimsOk ? info : null;
  } catch {
    console.log('[photoService] numeric-id probe:', m[1], '| no such local asset');
    return null;
  }
}

async function locationFromAssetInfo(
  assetRef: string | MediaLibrary.Asset,
  label: string
): Promise<Coordinates | null> {
  const info = await MediaLibrary.getAssetInfoAsync(assetRef);
  console.log(`[photoService] ${label} location =`, info.location ?? 'null');
  if (!info.location) return null;
  return {
    latitude: info.location.latitude,
    longitude: info.location.longitude,
    capturedAt: new Date(),
  };
}

export async function readPhotoCoordinates(
  asset: ImagePicker.ImagePickerAsset
): Promise<Coordinates | null> {
  const fromExif = coordsFromExif(asset.exif as any);
  const rawGps = (asset.exif as any)?.['{GPS}'] ?? asset.exif ?? {};
  console.log(
    '[photoService] photo coords: assetId =', asset.assetId ?? 'null',
    '| fileName =', asset.fileName ?? 'null',
    '| raw GPSLatitude =', JSON.stringify(rawGps.GPSLatitude ?? rawGps.Latitude ?? null),
    '| exif branch =', fromExif ? `hit (${fromExif.latitude}, ${fromExif.longitude})` : 'miss'
  );
  if (fromExif) return fromExif;

  // Parse the GPS straight out of the picked file's EXIF bytes. The reason
  // code distinguishes "photo has no GPS" (no-exif-app1 / no-gps-ifd) from
  // "the Photo Picker redacted it" (zeroed-coords).
  const fromFile = await gpsFromJpegFile(asset.uri);
  console.log(
    '[photoService] jpeg exif parse =',
    fromFile.coords
      ? `hit (${fromFile.coords.latitude}, ${fromFile.coords.longitude})`
      : `miss (${fromFile.reason})`
  );
  if (fromFile.coords) {
    return { ...fromFile.coords, capturedAt: new Date() };
  }

  try {
    if (!(await requestPhotoPermission())) return null;

    if (asset.assetId) {
      const coords = await locationFromAssetInfo(asset.assetId, 'getAssetInfoAsync');
      if (coords) return coords;
    }

    // Fallbacks: no (or fruitless) asset id from the picker. Try to re-find
    // the photo's ORIGINAL in the local library (the picker's copy is
    // location-redacted, the original is not) and read its location.
    if (Platform.OS === 'android' && asset.fileName) {
      const takenAt = parseExifDate(
        (asset.exif as any)?.DateTimeOriginal ?? (asset.exif as any)?.DateTime
      );
      const dims = { width: asset.width, height: asset.height };

      const probed = await probeNumericFilenameAsId(asset.fileName, takenAt, dims);
      if (probed) {
        const coords = await locationFromAssetInfo(probed, 'numeric-id probe');
        if (coords) return coords;
      }

      const match = await findLibraryAssetMatch(asset.fileName, takenAt, dims);
      console.log(
        '[photoService] library match fallback:', asset.fileName,
        '| takenAt =', takenAt?.toISOString() ?? 'null',
        '| match =', match ? `${match.id} (${match.filename})` : 'none'
      );
      if (match) {
        return await locationFromAssetInfo(match, 'library match');
      }
    }
  } catch (err) {
    console.log('[photoService] library location read failed:', err);
  }
  return null;
}

// Cap uploads at this longest edge / JPEG quality. Full camera originals
// (4032px, 2-3MB+) are what made feed photos fail to load on phone
// connections; ~2048px @ 0.85 lands around 300-600KB and still looks sharp
// in the pinch-zoom viewer. EXIF is stripped by the re-encode, which is fine:
// photo GPS is read from the library asset at pick time, never from the
// uploaded file (see readPhotoCoordinates).
const MAX_UPLOAD_EDGE = 2048;
const UPLOAD_JPEG_QUALITY = 0.85;

// Resize + re-encode a local photo for upload. Any failure falls back to the
// original file — a compression hiccup must never block saving a sighting.
async function compressForUpload(uri: string): Promise<string> {
  try {
    const { width, height } = await new Promise<{ width: number; height: number }>(
      (resolve, reject) =>
        RNImage.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)
    );
    const longest = Math.max(width, height);
    // Never upscale; small images just get re-encoded at upload quality.
    const actions =
      longest > MAX_UPLOAD_EDGE
        ? [width >= height ? { resize: { width: MAX_UPLOAD_EDGE } } : { resize: { height: MAX_UPLOAD_EDGE } }]
        : [];
    const result = await manipulateAsync(uri, actions, {
      compress: UPLOAD_JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });
    console.log(`[photoService] compressed upload ${width}x${height} -> ${result.width}x${result.height}`);
    return result.uri;
  } catch (err) {
    console.log('[photoService] compression failed, uploading original:', err);
    return uri;
  }
}

export interface UploadedPhoto {
  photoUrl: string;          // compressed display copy — what the app renders
  photoUrlOriginal?: string; // untouched original (archive; absent if that upload failed)
}

// Two-copy upload: the compressed display copy is the primary photo (fast to
// load everywhere, including old app builds, which read `photoUrl`); the
// original is archived untouched at the legacy `sightings/{id}` path so no
// quality is ever lost. Display copy first — it's the one the save depends on.
export async function uploadPhoto(uri: string, sightingId: string): Promise<UploadedPhoto> {
  try {
    const storage = getStorage();

    const toUpload = await compressForUpload(uri);
    const displayRef = ref(storage, `sightings/display/${sightingId}.jpg`);
    await putFile(displayRef, toUpload);
    const photoUrl = await getDownloadURL(displayRef);

    // Original archive is best-effort: a failure here never blocks the save.
    let photoUrlOriginal: string | undefined;
    try {
      const extension = uri.split('.').pop();
      const originalRef = ref(storage, `sightings/${sightingId}.${extension}`);
      await putFile(originalRef, uri);
      photoUrlOriginal = await getDownloadURL(originalRef);
    } catch (err) {
      console.log('[photoService] original archive upload failed (non-fatal):', err);
    }

    return { photoUrl, photoUrlOriginal };
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