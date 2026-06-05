// Custom "species" that aren't real birds in the IOC list but can be logged
// for fun (easter eggs). A custom species behaves like a real new species for
// the CELEBRATION (haptic buzz + "New species!" popup on first log) and gets a
// Dex tile under "Other", but it does NOT count toward the unique-species total
// or milestones — logging your friend Kelsey shouldn't inch you toward your
// next real-species milestone.
//
// Contrast with the other special entries:
//   - reportTypes (Bug Report / Feature Request): excluded from sightings AND
//     species counts; no tile, no celebration.
//   - Mystery Bird (unknownBird): counts as a sighting, but no species, no
//     tile, no celebration.
//   - custom species (here): counts as a sighting, gets a tile, celebrates,
//     but never adds to the species count.

export const CUSTOM_SPECIES = ['Kelsey'] as const;

export type CustomSpecies = (typeof CUSTOM_SPECIES)[number];

const customSet = new Set<string>(CUSTOM_SPECIES.map(s => s.toLowerCase()));

export function isCustomSpecies(name: string): boolean {
  return customSet.has(name.trim().toLowerCase());
}
