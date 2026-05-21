import { Coordinates } from '../types';

export interface PlaceSuggestion {
  placeId: string;
  description: string;     // full label, e.g. "Columbia Lake, Waterloo, ON, Canada"
  mainText: string;        // primary line, e.g. "Columbia Lake"
  secondaryText: string;   // secondary line, e.g. "Waterloo, ON, Canada"
}

interface PlaceDetailsResult {
  label: string;
  coordinates: Coordinates;
}

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

function ensureKey(): string | null {
  if (!API_KEY) {
    console.log('[placesService] EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set — autocomplete will return empty.');
    return null;
  }
  return API_KEY;
}

// Google Places Autocomplete. Biased toward biasCoords with a ~50km radius if
// provided. Returns up to 5 suggestions. Silent failure -> empty array.
export async function getPlacesAutocomplete(
  query: string,
  biasCoords?: Coordinates
): Promise<PlaceSuggestion[]> {
  const key = ensureKey();
  if (!key) return [];
  if (!query || query.trim().length < 2) return [];

  try {
    const params = new URLSearchParams({
      input: query,
      key,
      types: 'geocode|establishment',
    });
    if (biasCoords) {
      params.set('location', `${biasCoords.latitude},${biasCoords.longitude}`);
      params.set('radius', '50000');
    }

    const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.log('[placesService] Autocomplete status:', data.status, data.error_message);
      return [];
    }

    return (data.predictions || []).slice(0, 5).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text ?? p.description,
      secondaryText: p.structured_formatting?.secondary_text ?? '',
    }));
  } catch (err) {
    console.log('[placesService] Autocomplete failed:', err);
    return [];
  }
}

// Fetch Place Details for a chosen suggestion to retrieve its coordinates.
// Returns null on any failure.
export async function getPlaceCoordinates(
  placeId: string
): Promise<PlaceDetailsResult | null> {
  const key = ensureKey();
  if (!key || !placeId) return null;

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key,
      fields: 'name,formatted_address,geometry/location',
    });

    const res = await fetch(`${DETAILS_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.status !== 'OK' || !data.result) {
      console.log('[placesService] Details status:', data.status, data.error_message);
      return null;
    }

    const result = data.result;
    const loc = result.geometry?.location;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
      return null;
    }

    // Prefer the name (e.g. "Columbia Lake") over formatted_address (e.g. "123
    // Main St, Waterloo, ON N2L 3G1, Canada") for the label.
    const label = result.name || result.formatted_address || '';

    return {
      label,
      coordinates: {
        latitude: loc.lat,
        longitude: loc.lng,
        capturedAt: new Date(),
      },
    };
  } catch (err) {
    console.log('[placesService] Details failed:', err);
    return null;
  }
}

const placesService = {
  getPlacesAutocomplete,
  getPlaceCoordinates,
};

export default placesService;
