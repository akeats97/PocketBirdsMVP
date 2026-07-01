import * as Location from 'expo-location';
import { Coordinates } from '../types';

export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

interface LocationResult {
  label: string;
  coordinates: Coordinates;
}

// Reverse-geocode a coordinate to a human-readable label using expo-location's
// free native call. Returns '' on any failure (offline, no result). Shared by
// the locate button and the photo-location autofill.
export async function reverseGeocodeLabel(coords: {
  latitude: number;
  longitude: number;
}): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    if (results.length === 0) return '';
    const r = results[0];
    // The geocoder returns structured fields. On Android `name` is often just
    // the street number ("170"), so we can't trust it as a label. Build
    // something useful from the address pieces instead.
    const nameLooksLikeNumber = r.name && /^\d+[a-z]?$/i.test(r.name);
    const nameIsJustStreetNumber = r.name && r.name === r.streetNumber;
    const nameIsUseful = r.name && !nameLooksLikeNumber && !nameIsJustStreetNumber;

    if (nameIsUseful) {
      return r.name!;
    } else if (r.streetNumber && r.street) {
      return `${r.streetNumber} ${r.street}${r.city ? `, ${r.city}` : ''}`;
    } else if (r.street) {
      return `${r.street}${r.city ? `, ${r.city}` : ''}`;
    }
    return r.city || r.region || r.subregion || r.country || '';
  } catch (err) {
    console.log('[locationService] Reverse geocode failed:', err);
    return '';
  }
}

// One-shot GPS fix + reverse geocode to a human-readable label. Catches all
// errors and returns null so callers never need to think about failure modes.
//
// Strategy: prefer the OS-cached last-known position (instant) if it's recent
// enough, otherwise request a fresh fix with a timeout. Cold fresh fixes on
// Android can take 8+ seconds; using the cache makes consecutive locate taps
// feel snappy.
export async function getCurrentLocationWithLabel(
  opts: { timeoutMs?: number; maxAgeMs?: number } = {}
): Promise<LocationResult | null> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxAgeMs = opts.maxAgeMs ?? 60_000;

  try {
    let position: Location.LocationObject | null = null;

    try {
      position = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs });
    } catch (err) {
      console.log('[locationService] getLastKnownPositionAsync failed:', err);
    }

    if (!position) {
      position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
      ]);
    }

    if (!position) {
      console.log('[locationService] GPS fix timed out');
      return null;
    }

    const coordinates: Coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
      capturedAt: new Date(),
    };

    // Reverse-geocode using expo-location's free native call.
    const label = await reverseGeocodeLabel(coordinates);

    return { label, coordinates };
  } catch (err) {
    console.log('[locationService] getCurrentLocationWithLabel failed:', err);
    return null;
  }
}

// Coords-only, silent variant for biasing Places autocomplete. NEVER prompts:
// returns null unless location permission is already granted. Prefers the
// OS-cached last-known position (instant, works offline) over a fresh fix.
// No reverse-geocode.
export async function getCurrentCoordinates(
  opts: { timeoutMs?: number } = {}
): Promise<Coordinates | null> {
  const timeoutMs = opts.timeoutMs ?? 4000;

  try {
    if (!(await hasLocationPermission())) return null;

    let position: Location.LocationObject | null = null;
    try {
      position = await Location.getLastKnownPositionAsync();
    } catch (err) {
      console.log('[locationService] getLastKnownPositionAsync failed:', err);
    }

    if (!position) {
      position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
      ]);
    }

    if (!position) return null;

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
      capturedAt: new Date(),
    };
  } catch (err) {
    console.log('[locationService] getCurrentCoordinates failed:', err);
    return null;
  }
}

const locationService = {
  hasLocationPermission,
  requestLocationPermission,
  getCurrentLocationWithLabel,
  getCurrentCoordinates,
  reverseGeocodeLabel,
};

export default locationService;
