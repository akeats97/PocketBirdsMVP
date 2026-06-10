// Relative-then-absolute date for a sighting's observation date, as shown on
// the Field Journal sighting card (SightingCard / FriendSightingCard), the
// sighting detail, and the Venn compare hints. One implementation so they can't
// drift.
//
// Two rules, both learned from real bugs:
//   1. "today" / "yesterday" compare CALENDAR days in the device's local
//      timezone, NOT elapsed hours. A sighting logged at 9pm yesterday must read
//      "yesterday" when viewed at 9am today — an elapsed-hours check (<24h)
//      wrongly called that "today".
//   2. The absolute fallback ALWAYS includes the year ("Sep 3, 2025"), so an old
//      sighting is never an ambiguous "Sep 3".
export function formatRelativeDate(date: Date): string {
  const startOfLocalDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0); // local-midnight, so the diff is whole calendar days
    return x;
  };
  const days = Math.round(
    (startOfLocalDay(new Date()).getTime() - startOfLocalDay(date).getTime()) / 86_400_000,
  );
  if (days <= 0) return 'today'; // <0 only on clock skew / bad data; treat as today
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default formatRelativeDate;
