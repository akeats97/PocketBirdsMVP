// "Mystery Bird" is a special entry for logging a bird you saw but couldn't
// identify. The user surfaces it by typing "?" into the Add Sighting bird
// field. It rides the normal sighting pipeline (syncs to Firestore, shows in
// the Field Journal and friends' feeds, fires the friend-sighting push), but
// it is NOT a real species: it counts toward the SIGHTINGS total yet never
// adds a species to the Bird Dex, never appears as a Dex tile, and never
// triggers the new-species celebration / milestone math.
//
// Contrast with reportTypes (Bug Report / Feature Request), which are excluded
// from BOTH the sightings and species counts. A Mystery Bird counts as a real
// sighting; it just has no identified species.

export const UNKNOWN_BIRD = 'Mystery Bird';

export function isUnknownEntry(name: string): boolean {
  return name.trim().toLowerCase() === UNKNOWN_BIRD.toLowerCase();
}

// Predicate reused by the Community ID feature: a sighting is a Mystery Bird
// when its species is the "?" sentinel. Gate every community-ID surface on
// this so widening scope later (to already-identified sightings) is a one-line
// change. Takes a minimal shape to avoid importing app/types here.
export function isMysteryBird(sighting: { birdName: string }): boolean {
  return isUnknownEntry(sighting.birdName);
}
