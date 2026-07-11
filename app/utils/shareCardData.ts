// Maps a Sighting into the props the shareable ShareCard renders. Everything on
// the card except the photo, place, date and logger comes from the app's own
// bundled Species Guide data (AVONET morphology, IUCN status, the eight realms),
// so a card teaches something even when the sighting has no note.

import { avonetFor } from '../../constants/avonet';
import { RegionCode } from '../../constants/birdNames';
import { regionsFor } from '../../constants/birdNames';
import { IUCNStatusCode, STATUS_LABEL } from '../../constants/Colors';
import { statusFor } from '../../constants/iucnStatus';
import { avatarColor } from './avatarColor';
import { familyFor } from './speciesCatalog';
import { Sighting } from '../types';

// Rarity ladder — achievement only (no "photographed" tier; sharing implies a
// photo). base -> lifer -> global. Mirrors the app's own decoration ladder.
export type ShareRarity = 'base' | 'lifer' | 'global';

export interface StatValue {
  value: string;
  unit: string;
}

export interface ShareCardData {
  name: string;
  family: string | null;
  dexNumber: number | null;
  photoUrl?: string;
  hue: number; // fallback art gradient when there's no photo
  location: string | null;
  dateLabel: string;
  loggedBy: string; // "@handle"
  avatarLetter: string;
  avatarColor: string;
  mass: StatValue | null;
  wing: StatValue | null;
  habitat: string | null;
  diet: string | null;
  migration: string | null;
  regions: RegionCode[];
  statusCode: IUCNStatusCode;
  statusLabel: string;
  rarity: ShareRarity;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMass(grams: number | null): StatValue | null {
  if (grams == null) return null;
  if (grams >= 1000) return { value: (grams / 1000).toFixed(1), unit: 'kg' };
  if (grams < 100) return { value: grams.toFixed(1), unit: 'g' };
  return { value: String(Math.round(grams)), unit: 'g' };
}

function formatWing(mm: number | null): StatValue | null {
  if (mm == null) return null;
  return { value: String(Math.round(mm)), unit: 'mm' };
}

const MIGRATION_LABEL: Record<string, string> = {
  sedentary: 'Resident',
  partial: 'Partial',
  migratory: 'Migratory',
};

// A hue for the fallback art gradient, derived from the name so it's stable.
function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function buildShareCardData(
  sighting: Sighting,
  opts: { loggedBy: string; isLifer: boolean; dexNumber: number | null }
): ShareCardData {
  const av = avonetFor(sighting.birdName);
  const statusCode = statusFor(sighting.birdName);

  // Gold Global First reuses the app's gate: the claim is only decorated once an
  // admin has verified it (guards against joke logs claiming a species).
  const isGlobal = sighting.globalFirst === true && sighting.verified === true;
  const rarity: ShareRarity = isGlobal ? 'global' : opts.isLifer ? 'lifer' : 'base';

  const handle = opts.loggedBy.replace(/^@/, '');

  return {
    name: sighting.birdName,
    family: familyFor(sighting.birdName),
    dexNumber: opts.dexNumber,
    photoUrl: sighting.photoUrl,
    hue: hueFor(sighting.birdName),
    location: sighting.location || null,
    dateLabel: formatDate(sighting.date),
    loggedBy: `@${handle}`,
    avatarLetter: (handle || '?').charAt(0).toUpperCase(),
    avatarColor: avatarColor(handle),
    mass: formatMass(av?.mass ?? null),
    wing: formatWing(av?.wingChord ?? null),
    habitat: av?.habitat ?? null,
    diet: av?.diet ?? null,
    migration: av?.migration ? MIGRATION_LABEL[av.migration] : null,
    regions: regionsFor(sighting.birdName),
    statusCode,
    statusLabel: STATUS_LABEL[statusCode],
    rarity,
  };
}
