import { isReportEntry } from '../../constants/reportTypes';
import { Coordinates, Sighting } from '../types';

export interface RecentLocation {
  label: string;
  coordinates?: Coordinates;
}

// The user's most-recently-logged locations, derived from the live sightings
// list (no separate storage — survives reinstall via the Firestore re-hydrate).
// Deduped by label (case-insensitive); each label carries the coordinates from
// its most recent occurrence. Report entries are excluded (they have no real
// location); Mystery Birds are included — an unidentified bird was still seen
// at a real place.
export function buildRecentLocations(sightings: Sighting[], limit = 6): RecentLocation[] {
  const sorted = [...sightings].sort(
    (a, b) =>
      b.date.getTime() - a.date.getTime() ||
      b.lastModified.getTime() - a.lastModified.getTime()
  );

  const seen = new Set<string>();
  const recents: RecentLocation[] = [];
  for (const s of sorted) {
    const label = s.location?.trim();
    if (!label || isReportEntry(s.birdName)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recents.push({ label, coordinates: s.coordinates });
    if (recents.length >= limit) break;
  }
  return recents;
}
