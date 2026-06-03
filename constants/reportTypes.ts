// "Bug Report" and "Feature Request" are special entries a user can log from
// the Add Sighting screen to send feedback. They ride the normal sighting
// pipeline (so they sync to Firestore and fire the existing friend-sighting
// push), but they are NOT real species: they don't require a location, and
// they're filtered out of the user's own Bird Dex, Field Journal, and the
// new-species / milestone math.

export const REPORT_TYPES = ['Bug Report', 'Feature Request'] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

const reportSet = new Set<string>(REPORT_TYPES);

export function isReportEntry(name: string): boolean {
  return reportSet.has(name);
}
