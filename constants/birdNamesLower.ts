import { birdNames } from './birdNames';

// Pre-computed lowercase version of birdNames for hot-path search.
// Avoids 11K+ string allocations per keystroke in the Add Sighting suggestions
// useEffect. Build cost is paid once at module load.
export const birdNamesLower: string[] = birdNames.map(n => n.toLowerCase());

// Alphabetically-sorted copy of birdNames for search ordering. Iterating an
// already-sorted array lets the search loop early-exit once enough top-tier
// matches are found, avoiding a per-keystroke sort of thousands of matches.
export const birdNamesAlpha: string[] = [...birdNames].sort((a, b) =>
  a < b ? -1 : a > b ? 1 : 0
);
export const birdNamesAlphaLower: string[] = birdNamesAlpha.map(n => n.toLowerCase());

// Forgiving-search normalization (WORK_QUEUE UR-6): lets American spellings and
// space-vs-dash typing match the IOC list's British spellings + hyphenated
// compound names. "gray plover" → "Grey Plover", "red breasted" → "Red-breasted
// Nuthatch". Substitutions are deliberately minimal (just grey→gray) — no fuzzy
// matching. Apply to BOTH the query and the index so both sides line up.
export const normalizeSearch = (s: string): string =>
  s.toLowerCase().replace(/grey/g, 'gray').replace(/-/g, ' ').replace(/\s+/g, ' ');

// Precomputed parallel array to birdNamesAlpha, normalized once at module load.
// The bird search is a documented hot path (11K names scanned per keystroke), so
// matching runs against this array instead of normalizing names inside the loop.
export const birdNamesAlphaNorm: string[] = birdNamesAlpha.map(normalizeSearch);

// Separator-stripped variant: handles the user dropping the dash ENTIRELY rather
// than swapping it for a space ("redeyed vireo" → "Red-eyed Vireo"). normalizeSearch
// only turns the dash into a space, so "redeyed" still wouldn't line up with
// "red eyed" — this index removes all spaces so the run-together form matches.
// Used as a lowest-priority fallback tier (see the search loops).
export const compactSearch = (s: string): string => normalizeSearch(s).replace(/ /g, '');
export const birdNamesAlphaCompact: string[] = birdNamesAlpha.map(compactSearch);
