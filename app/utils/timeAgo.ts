// Compact relative timestamp for social rows: "now", "5m", "3h", "2d", then a
// short date ("Jun 9") past a week. Pass withSuffix for the "5m ago" form
// (the suffix is skipped on "now" and on dates).
export function timeAgo(date: Date | null, withSuffix = false): string {
  if (!date) return 'now';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'now';
  const ago = withSuffix ? ' ago' : '';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m${ago}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h${ago}`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d${ago}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
