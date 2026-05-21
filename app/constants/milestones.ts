// Species-count milestones that trigger a celebration:
// 5, 10, 25, 50, 100, 150, 200, ...
// (the "fives" tier early on, then every 50 from 50 onward)

const EARLY = new Set<number>([5, 10, 25]);

export function isMilestone(count: number): boolean {
  if (count < 5) return false;
  if (EARLY.has(count)) return true;
  return count >= 50 && count % 50 === 0;
}

// Short headline shown on the takeover modal. Falls back to a generic line
// for any milestone past the curated tier.
export function milestoneTagline(count: number): string {
  switch (count) {
    case 5:   return 'Five species! Birding is officially happening.';
    case 10:  return 'Double digits! ✨';
    case 25:  return 'Quarter-century of birds!';
    case 50:  return 'Fifty species! 🪶';
    case 100: return 'Century club! 💯';
    case 150: return '150 species? Jeez, what a nerd!';
    case 200: return 'Two hundred species!';
    case 250: return 'Quarter of a thousand!';
    case 500: return 'Five hundred! That\'s a lot of birds.';
    case 1000: return 'A THOUSAND species. Who are you?';
    default:  return `${count} species!`;
  }
}

const milestones = { isMilestone, milestoneTagline };
export default milestones;
