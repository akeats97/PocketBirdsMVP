// Build a per-user "Bird Dex" view from their sightings: which families they've
// logged species in, how many of each family they've seen, and the seen species
// (with per-species counts). Used by the profile's Bird Dex tab.
//
// Scoped to the user's OWN seen species so it stays bounded — we don't render
// the full 11k-species grid on a profile.

import { birdFamilies } from '../../constants/birdNames';
import { isReportEntry } from '../../constants/reportTypes';
import { isUnknownEntry } from '../../constants/unknownBird';
import { isCustomSpecies } from '../../constants/customSpecies';
import { Sighting } from '../types';

export interface DexSpecies {
  name: string;        // display-cased
  count: number;       // times seen
  globalFirst: boolean; // user was first on PocketBirds to log this species
}

export interface DexFamily {
  family: string;
  seen: number;        // distinct seen species in this family
  total: number;       // species in this family (the IOC denominator)
  species: DexSpecies[]; // seen species, alphabetical
}

// Lowercase species name -> family, and family -> total species count. Built
// once from the static IOC list at module load.
const nameToFamily = new Map<string, string>();
const familyTotals = new Map<string, number>();
for (const fam of birdFamilies) {
  familyTotals.set(fam.family, fam.birds.length);
  for (const b of fam.birds) {
    nameToFamily.set(b.name.toLowerCase(), fam.family);
  }
}
const FAMILY_ORDER = new Map(birdFamilies.map((f, i) => [f.family, i]));

function isCountableSpecies(birdName: string): boolean {
  return !isReportEntry(birdName) && !isUnknownEntry(birdName) && !isCustomSpecies(birdName);
}

export function buildUserDex(sightings: Sighting[]): DexFamily[] {
  // species key (lower) -> { display, count, family, globalFirst }
  const species = new Map<string, { display: string; count: number; family: string; globalFirst: boolean }>();
  for (const s of sightings) {
    if (!isCountableSpecies(s.birdName)) continue;
    const key = s.birdName.toLowerCase();
    const family = nameToFamily.get(key) ?? 'Other';
    // Gold global-first only counts once an admin has verified the claim.
    const verifiedFirst = s.globalFirst === true && s.verified === true;
    const existing = species.get(key);
    if (existing) {
      existing.count += 1;
      if (verifiedFirst) existing.globalFirst = true;
    } else {
      species.set(key, { display: s.birdName, count: 1, family, globalFirst: verifiedFirst });
    }
  }

  // group by family
  const byFamily = new Map<string, DexSpecies[]>();
  for (const { display, count, family, globalFirst } of species.values()) {
    const list = byFamily.get(family);
    if (list) list.push({ name: display, count, globalFirst });
    else byFamily.set(family, [{ name: display, count, globalFirst }]);
  }

  const families: DexFamily[] = [];
  for (const [family, list] of byFamily) {
    list.sort((a, b) => a.name.localeCompare(b.name));
    families.push({
      family,
      seen: list.length,
      total: familyTotals.get(family) ?? list.length,
      species: list,
    });
  }

  // taxonomic order; "Other" (orphan / legacy names) sinks to the end
  families.sort((a, b) => {
    const ai = FAMILY_ORDER.get(a.family) ?? Number.MAX_SAFE_INTEGER;
    const bi = FAMILY_ORDER.get(b.family) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
  return families;
}

export default buildUserDex;
