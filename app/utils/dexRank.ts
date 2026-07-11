import { isCustomSpecies } from '../../constants/customSpecies';
import { isReportEntry } from '../../constants/reportTypes';
import { isUnknownEntry } from '../../constants/unknownBird';
import { Sighting } from '../types';

const isRealSpecies = (name: string) =>
  !isReportEntry(name) && !isUnknownEntry(name) && !isCustomSpecies(name);

// The logger's life-list position for `species`: among their distinct real
// species ordered by first-seen date, the 1-based rank of this species (their
// "Nth species"). Also reports whether `thisSightingId` is that first sighting,
// which is what makes the share card a lifer. Works for any user as long as you
// pass their full sighting history (own from context, a friend's via fetch).
export function dexRankForSpecies(
  sightings: Sighting[],
  species: string,
  thisSightingId: string
): { rank: number | null; isLifer: boolean } {
  const key = species.toLowerCase();
  // speciesLower -> earliest sighting { time, id }
  const first = new Map<string, { time: number; id: string }>();
  for (const s of sightings) {
    if (!isRealSpecies(s.birdName)) continue;
    const k = s.birdName.toLowerCase();
    const time = s.date.getTime();
    const cur = first.get(k);
    if (!cur || time < cur.time) first.set(k, { time, id: s.id });
  }

  const mine = first.get(key);
  if (!mine) return { rank: null, isLifer: false };

  // Rank = how many distinct species were first seen before this one (name
  // breaks same-day ties, so the number is stable across renders).
  let rank = 1;
  for (const [k, v] of first) {
    if (k === key) continue;
    if (v.time < mine.time || (v.time === mine.time && k < key)) rank++;
  }
  return { rank, isLifer: mine.id === thisSightingId };
}
