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

// One-shot GPS fix + reverse geocode to a human-readable label. Catches all
// errors and returns null so callers never need to think about failure modes.
export async function getCurrentLocationWithLabel(
  opts: { timeoutMs?: number } = {}
): Promise<LocationResult | null> {
  const timeoutMs = opts.timeoutMs ?? 8000;

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]);

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
    let label = '';
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      if (results.length > 0) {
        const r = results[0];
        // The geocoder returns structured fields. On Android `name` is often
        // just the street number ("170"), so we can't trust it as a label.
        // Build something useful from the address pieces instead.
        const nameLooksLikeNumber = r.name && /^\d+[a-z]?$/i.test(r.name);
        const nameIsJustStreetNumber = r.name && r.name === r.streetNumber;
        const nameIsUseful = r.name && !nameLooksLikeNumber && !nameIsJustStreetNumber;

        if (nameIsUseful) {
          // Named place like "Columbia Lake" or a business name.
          label = r.name!;
        } else if (r.streetNumber && r.street) {
          label = `${r.streetNumber} ${r.street}`;
          if (r.city) label += `, ${r.city}`;
        } else if (r.street) {
          label = r.street;
          if (r.city) label += `, ${r.city}`;
        } else {
          label = r.city || r.region || r.subregion || r.country || '';
        }
      }
    } catch (err) {
      console.log('[locationService] Reverse geocode failed, returning coords only:', err);
    }

    return { label, coordinates };
  } catch (err) {
    console.log('[locationService] getCurrentLocationWithLabel failed:', err);
    return null;
  }
}

const locationService = {
  hasLocationPermission,
  requestLocationPermission,
  getCurrentLocationWithLabel,
};

export default locationService;
