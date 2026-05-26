import { Sighting } from '../types';

export interface DaySection {
  key: string; // YYYY-MM-DD in the device's local time
  title: string; // e.g. "Saturday, May 23"
  date: Date; // local start-of-day for the bucket, used for sorting
  data: Sighting[]; // that day's sightings, reverse-chronological
  sightingCount: number;
  speciesCount: number;
}

// Bucket key from the LOCAL calendar day, so a sighting at 11:55 PM and one
// at 12:05 AM fall on different days (matches what the user perceives).
function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function groupSightingsByDay(sightings: Sighting[]): DaySection[] {
  const buckets = new Map<string, Sighting[]>();
  for (const s of sightings) {
    const key = localDayKey(s.date);
    const existing = buckets.get(key);
    if (existing) existing.push(s);
    else buckets.set(key, [s]);
  }

  const sections: DaySection[] = [];
  for (const [key, items] of buckets) {
    const data = [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
    const first = data[0].date;
    const date = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    const title = date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const speciesCount = new Set(data.map((s) => s.birdName.toLowerCase())).size;
    sections.push({ key, title, date, data, sightingCount: data.length, speciesCount });
  }

  sections.sort((a, b) => b.date.getTime() - a.date.getTime());
  return sections;
}

export default groupSightingsByDay;
