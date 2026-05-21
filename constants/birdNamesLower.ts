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
