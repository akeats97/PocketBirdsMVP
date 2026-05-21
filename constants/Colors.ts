/**
 * Pocket Dex design tokens.
 *
 * Drop-in replacement for the previous `constants/Colors.ts`. Import these
 * everywhere a StyleSheet currently uses a hard-coded color, font family, or
 * magic number.
 *
 * Goal: every value in any new StyleSheet should resolve to a token in this
 * file. If you find yourself reaching for a hex code that isn't here, either
 * (a) add it here with a name + comment explaining when to use it, or (b)
 * pick the closest existing token. Do not inline.
 */

// Palette
// Background hierarchy: app surface is `cream`, cards sit on `card` (white)
// with a 2px `ink` border. `ink` is the only text-on-light color. `inkSoft`
// is for secondary text / meta. `muted` is for placeholder / disabled.

export const palette = {
  // Surfaces
  cream:    '#fdf6e6',  // app background; the "paper" of the whole UI
  card:     '#ffffff',  // card surfaces sit on cream
  ink:      '#1a2417',  // primary text; also every border + every hard shadow
  inkSoft:  '#5d6b58',  // secondary text, meta, labels
  muted:    '#a8b0a4',  // placeholder text, disabled icons, "?" tiles

  // Accent, used for STATE, not decoration. Pick by meaning, not by vibe.
  leaf:      '#2d8a3e',  // success, primary action, "you've seen it",
                          // location verified, primary CTA fill
  leafSoft:  '#e0f0d6',  // tinted background for active tab pill, success chips

  sun:       '#f5b800',  // attention, streak, highlight, secondary CTA fill
  sunSoft:   '#fef0c2',

  sky:       '#3d7fc4',  // info, friend / social cues, neutral accent on
                          // friend avatars
  skySoft:   '#dde8f5',

  coral:     '#e85a3a',  // celebratory, new species (lifer!), alert,
                          // destructive confirmation, conservation: ENDANGERED
  coralSoft: '#fce0d8',

  // Conservation-status-only color. The accent palette above covers LC / NT /
  // VU / EN. Critical (CR) needs its own deeper coral so it reads as
  // "genuine alarm" rather than "just another EN." Extinct uses `ink`.
  crimson:   '#b8392a',  // CRITICALLY ENDANGERED

  // Hairlines + subtle dividers (alpha over ink so it adapts on tinted bg)
  rule:      'rgba(26, 36, 23, 0.08)',
};

// Typography
// Three families. Use the role names below; never reach for a Family Name in
// a component.
//
//   display, Bricolage Grotesque. Big chunky titles, bird names, key
//            numbers. Always 600-800 weight. Tight letter-spacing.
//   body,    Space Grotesk. Everything else readable. 400-700.
//   mono,    DM Mono. Latin names, coordinates, timestamps, "RARE",
//            usernames, counters, ID numbers. Italic Latin only.

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displayBlack: 'BricolageGrotesque_800ExtraBold',
  body: 'SpaceGrotesk_500Medium',
  bodyBold: 'SpaceGrotesk_700Bold',
  mono: 'DMMono_400Regular',
  monoBold: 'DMMono_500Medium',
};

// Type scale, sized for mobile. Numbers in px (RN's default unit).
// `lh` is recommended lineHeight; multiply by your own scale if you want.
export const type = {
  // Display: chunky display font, tight tracking
  h1:    { fontFamily: font.display,     fontSize: 30, lineHeight: 32, letterSpacing: -1.0 },
  h2:    { fontFamily: font.display,     fontSize: 22, lineHeight: 24, letterSpacing: -0.5 },
  h3:    { fontFamily: font.display,     fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },

  // Body: regular sans
  bodyL: { fontFamily: font.body,        fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  body:  { fontFamily: font.body,        fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  bodyS: { fontFamily: font.body,        fontSize: 12, lineHeight: 16, letterSpacing: 0 },

  // Labels: small uppercase body
  label: { fontFamily: font.bodyBold,    fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' as const },

  // Mono: Latin names, coordinates, "RARE", IDs, timestamps
  mono:    { fontFamily: font.mono,      fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  monoTag: { fontFamily: font.monoBold,  fontSize: 10, lineHeight: 12, letterSpacing: 1.5, textTransform: 'uppercase' as const },
};

// Spacing
// 4-pt grid. Use these instead of magic numbers in padding/margin/gap.
export const space = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,   // default card inner padding
  xl:  20,   // default screen edge padding
  xxl: 28,
};

// Radii
export const radius = {
  chip:   10,   // small chips, filter pills (non-circular)
  input:  14,   // input fields, buttons, secondary cards
  card:   18,   // primary content cards (sighting card, friend card)
  pill:   999,  // status pills, "Add" button, rarity badges
};

// Borders
// THE 2px ink border is the most identifying element of this language.
// Always use these, never invent border widths.
export const border = {
  thin:  { borderWidth: 1.5, borderColor: palette.ink },
  thick: { borderWidth: 2,   borderColor: palette.ink },  // default for cards & inputs
  hairline: { borderWidth: 1, borderColor: palette.rule }, // only for internal dividers
};

// Hard shadows
// The signature "neobrutalist" offset shadow. RN's shadow props won't get
// you a hard-edge shadow, use one of these helpers instead.
//
// Pattern: wrap the shadowed view in a parent View with positioning, then
// place a SOLID INK View one layer below offset by (sx, sy). The shadow View
// has the same border-radius as the card. Example in
// components/SightingCard.tsx.
//
// On Android, set `elevation: 0` on the card to suppress the default
// platform shadow (otherwise you get TWO shadows).
export const shadow = {
  hard: (sx = 4, sy = 4) => ({ sx, sy, color: palette.ink }),
  hardSm: { sx: 2, sy: 2, color: palette.ink },
  hardMd: { sx: 3, sy: 3, color: palette.ink },
  hardLg: { sx: 4, sy: 4, color: palette.ink },
};

// IUCN conservation status
// Types + visual mappings ship now; the per-species lookup (statusFor) is
// deferred until the Wikidata dump exists (see wikidata-dump.md).

export type IUCNStatusCode =
  | 'LC'   // Least Concern
  | 'NT'   // Near Threatened
  | 'VU'   // Vulnerable
  | 'EN'   // Endangered
  | 'CR'   // Critically Endangered
  | 'EW'   // Extinct in the Wild
  | 'EX'   // Extinct
  | 'DD'   // Data Deficient
  | 'NE';  // Not Evaluated (or no Wikidata hit)

export const STATUS_LABEL: Record<IUCNStatusCode, string> = {
  LC: 'Least Concern',
  NT: 'Near Threatened',
  VU: 'Vulnerable',
  EN: 'Endangered',
  CR: 'Critically Endangered',
  EW: 'Extinct in the Wild',
  EX: 'Extinct',
  DD: 'Data Deficient',
  NE: 'Not Evaluated',
};

// Single source of truth for how a status renders anywhere in the app.
export const STATUS_VISUAL: Record<IUCNStatusCode, { bg: string; fg: string }> = {
  LC: { bg: palette.leafSoft,  fg: palette.leaf    },
  NT: { bg: palette.sunSoft,   fg: palette.ink     },
  VU: { bg: palette.sun,       fg: palette.ink     },
  EN: { bg: palette.coral,     fg: '#fff'          },
  CR: { bg: palette.crimson,   fg: '#fff'          },
  EW: { bg: palette.ink,       fg: palette.cream   },
  EX: { bg: palette.ink,       fg: palette.cream   },
  DD: { bg: '#e5e2d8',         fg: palette.inkSoft },
  NE: { bg: '#e5e2d8',         fg: palette.inkSoft },
};

// Component recipes
// Most common composite styles. Spread these into StyleSheet entries.

export const recipes = {
  // Primary card, white surface, 2px ink border, hard shadow handled by
  // wrapping component.
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    ...border.thick,
    overflow: 'hidden' as const,
    elevation: 0, // suppress Android default shadow
  },

  // Input, same as card but smaller radius + tighter padding.
  input: {
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    ...border.thick,
    fontFamily: font.body,
    fontSize: 14,
    color: palette.ink,
  },

  // Primary button, leaf green CTA. Pair with the hard-shadow wrapper.
  buttonPrimary: {
    backgroundColor: palette.leaf,
    borderRadius: radius.input,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    ...border.thick,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonPrimaryText: {
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: -0.3,
  },

  // Secondary button, sun yellow. Used for "Here" (locate), "Add", etc.
  buttonSecondary: {
    backgroundColor: palette.sun,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    ...border.thick,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  // Conservation-status strip, full-width band at top of a sighting card.
  // Apply to a View placed as the first child INSIDE the card (so it
  // inherits the card's border-radius clipping).
  statusStrip: (code: IUCNStatusCode) => ({
    backgroundColor: STATUS_VISUAL[code].bg,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  }),
  statusStripText: (code: IUCNStatusCode) => ({
    ...type.monoTag,
    color: STATUS_VISUAL[code].fg,
    fontWeight: '600' as const,
  }),

  // Label text, small uppercase, used above every form field.
  fieldLabel: {
    ...type.label,
    color: palette.inkSoft,
    marginBottom: space.xs,
  },

  // Mono Latin name, italic, soft ink.
  latin: {
    ...type.mono,
    color: palette.inkSoft,
    fontStyle: 'italic' as const,
  },

  // Lifer badge, coral pill with star.
  liferBadge: {
    backgroundColor: palette.coral,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  liferBadgeText: {
    color: '#fff',
    fontFamily: font.bodyBold,
    fontSize: 9.5,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
};

// Theme export, what `useThemeColor` consumes.
// Dark mode is deferred until after the light-mode redesign lands.
export const theme = {
  light: {
    background: palette.cream,
    surface: palette.card,
    text: palette.ink,
    textSoft: palette.inkSoft,
    textMuted: palette.muted,
    tint: palette.leaf,
    border: palette.ink,
    rule: palette.rule,
    tabIconDefault: palette.muted,
    tabIconSelected: palette.leaf,
  },
};

// Legacy compat, keep the old `Colors` export so existing imports don't break.
// New code should import from `palette` / `theme` / `recipes` directly.
export const Colors = {
  light: {
    text: theme.light.text,
    background: theme.light.background,
    tint: theme.light.tint,
    icon: theme.light.textSoft,
    tabIconDefault: theme.light.tabIconDefault,
    tabIconSelected: theme.light.tabIconSelected,
  },
  dark: {
    // Placeholder, still light values until dark mode is designed.
    text: theme.light.text,
    background: theme.light.background,
    tint: theme.light.tint,
    icon: theme.light.textSoft,
    tabIconDefault: theme.light.tabIconDefault,
    tabIconSelected: theme.light.tabIconSelected,
  },
};
