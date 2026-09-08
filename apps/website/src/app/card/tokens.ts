/**
 * Social-card palette: the site's light surface, resolved to literals.
 *
 * Satori cannot read CSS variables, so these are copied from the design
 * tokens rather than referenced. Sources:
 *   - libs/design-tokens/src/lib/theme.css (light `--color-*`)
 *   - apps/website/src/styles/ui.css (BrowserFrame chrome, traffic lights)
 * If those change, re-resolve these.
 *
 * The card is light because the site is: the hero is flat white and every
 * docs page is light, so a dark card advertised a product that looked like
 * something else the moment the link was opened.
 */
export const CARD = {
  /** --color-surface-tinted, the card ground. */
  ground: '#fbfbfb',
  /** --color-canvas */
  canvas: '#ffffff',
  /** --color-surface-dim, the user bubble. */
  dim: '#f5f5f5',
  /** --color-text-primary / secondary / muted */
  ink: '#0a0a0a',
  inkSecondary: '#464646',
  inkMuted: '#737373',
  /** --color-border / --color-border-strong */
  border: '#e5e5e5',
  borderStrong: '#c8c8c8',
  /** --color-accent and its surface/border tints. */
  accent: '#15253e',
  accentSurface: 'rgba(255, 175, 0, 0.10)',
  accentBorder: 'rgba(255, 175, 0, 0.35)',
  /** BrowserFrame traffic lights (ui.css). */
  trafficRed: '#FF5F57',
  trafficAmber: '#FEBC2E',
  trafficGreen: '#28C840',
} as const;

/**
 * The floor for readable type on a share card.
 *
 * Timelines render 1200x630 at roughly 500px, about 0.42x, and Slack unfurls
 * it narrower still. Below this a glyph stops being read and becomes texture.
 * Everything the card needs a human to actually read stays at or above it.
 */
export const MIN_READABLE_PX = 18;
