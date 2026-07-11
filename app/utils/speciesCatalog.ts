// Static per-species lookup off the IOC list: the species' family (common
// name). Stable and user-independent, so it works for any sighting.

import { birdFamilies } from '../../constants/birdNames';

const nameToFamily = new Map<string, string>();
for (const fam of birdFamilies) {
  for (const b of fam.birds) {
    nameToFamily.set(b.name.toLowerCase(), fam.family);
  }
}

/** Family common name (e.g. "New World warblers"), or null for legacy/off-list names. */
export function familyFor(name: string): string | null {
  return nameToFamily.get(name.trim().toLowerCase()) ?? null;
}
