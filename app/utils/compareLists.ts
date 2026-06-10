// Compare two birders' life lists.
//
// Pure functions, no React / Firebase — drives both the profile stat strip and
// the Venn compare screen. Uses the SAME exclusions the Field Journal uses so
// counts match across the app:
//   - Bug Report / Feature Request (isReportEntry): not a sighting, not a species
//   - "Mystery Bird" (isUnknownEntry): a sighting, but never a species
//   - custom easter-egg species, e.g. Kelsey (isCustomSpecies): a sighting +
//     a Dex tile, but never counted toward the species total
//
// Identity is case-insensitive (lowercase key), but a display-cased name is
// preserved for rendering.

import { isReportEntry } from '../../constants/reportTypes';
import { isUnknownEntry } from '../../constants/unknownBird';
import { isCustomSpecies } from '../../constants/customSpecies';
import { formatRelativeDate } from './formatSightingDate';
import { Sighting } from '../types';

/** True if this entry is a real, countable species (not a report / mystery / custom). */
function isCountableSpecies(birdName: string): boolean {
  return !isReportEntry(birdName) && !isUnknownEntry(birdName) && !isCustomSpecies(birdName);
}

/** Distinct, countable species set for a user (lowercase keys for identity). */
export function speciesSet(sightings: Sighting[]): Set<string> {
  return new Set(
    sightings
      .filter(s => isCountableSpecies(s.birdName))
      .map(s => s.birdName.toLowerCase())
  );
}

/** Real-sighting count — excludes only reports (Mystery Bird still counts). */
export function sightingCount(sightings: Sighting[]): number {
  return sightings.filter(s => !isReportEntry(s.birdName)).length;
}

export interface Comparison {
  overlap: number;          // 0–100, the headline % (Jaccard index)
  shared: number;           // species you both have
  onlyYou: number;          // you have, they don't
  onlyThem: number;         // they have, you don't
  union: number;            // onlyYou + shared + onlyThem
  sharedList: string[];     // display names, both have (sorted)
  onlyYouList: string[];    // display names, only you (sorted)
  onlyThemList: string[];   // display names, only them (sorted)
}

/**
 * Compare your species set against theirs. Symmetric — order doesn't matter.
 * overlap % = round(shared / union * 100), the Jaccard index, so it's bounded
 * to 0–100 and identical whichever way you pass the two lists.
 */
export function compareLists(mine: Sighting[], theirs: Sighting[]): Comparison {
  // Keep a display-cased name per lowercase key.
  const label = new Map<string, string>();
  const keysOf = (list: Sighting[]) => {
    const keys = new Set<string>();
    for (const s of list) {
      if (!isCountableSpecies(s.birdName)) continue;
      const k = s.birdName.toLowerCase();
      keys.add(k);
      if (!label.has(k)) label.set(k, s.birdName);
    }
    return keys;
  };

  const you = keysOf(mine);
  const them = keysOf(theirs);

  const sharedKeys = [...you].filter(k => them.has(k));
  const onlyYouKeys = [...you].filter(k => !them.has(k));
  const onlyThemKeys = [...them].filter(k => !you.has(k));

  const shared = sharedKeys.length;
  const onlyYou = onlyYouKeys.length;
  const onlyThem = onlyThemKeys.length;
  const union = shared + onlyYou + onlyThem;

  const overlap = union === 0 ? 0 : Math.round((shared / union) * 100);

  const names = (keys: string[]) => keys.map(k => label.get(k)!).sort();

  return {
    overlap, shared, onlyYou, onlyThem, union,
    sharedList: names(sharedKeys),
    onlyYouList: names(onlyYouKeys),
    onlyThemList: names(onlyThemKeys),
  };
}

/** Most-recent sighting per species (lowercase key) for one person's list. */
export function latestBySpecies(list: Sighting[]): Map<string, Sighting> {
  const m = new Map<string, Sighting>();
  for (const s of [...list].sort((a, b) => b.date.getTime() - a.date.getTime())) {
    const k = s.birdName.toLowerCase();
    if (!m.has(k)) m.set(k, s);
  }
  return m;
}

/** "5 days ago", "2 wk ago", "Sep 3, 2025" — the app's shared card formatter. */
export const relativeTime = formatRelativeDate;

/** The "where · when" hint line under a species in the Venn buckets. */
export function hintFor(sighting: Sighting | undefined): string {
  if (!sighting) return '';
  const where = sighting.location?.trim();
  const when = relativeTime(sighting.date);
  return where ? `${where} · ${when}` : when;
}

export default compareLists;
