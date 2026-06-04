import { palette } from '../../constants/Colors';

// The three accent colors an avatar can take. Picked deterministically from a
// seed (a uid or stable id) so the same person always gets the same color.
export const AVATAR_COLORS = [palette.sky, palette.leaf, palette.coral];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
