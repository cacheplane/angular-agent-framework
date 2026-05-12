/**
 * Section and container spacing scale.
 *
 * `sectionY` is the standard vertical breathing room around each
 * marketing section (clamps between 64px mobile and 120px desktop).
 * `sectionYTight` is for compact sections (proof strip, final CTA).
 * `containerX` is the horizontal page padding. `containerMax` is the
 * max content width before the page gutters take over.
 */
export const space = Object.freeze({
  sectionY: 'clamp(64px, 8vw, 120px)',
  sectionYTight: 'clamp(48px, 6vw, 80px)',
  containerX: 'clamp(20px, 4vw, 40px)',
  containerMax: '1200px',
} as const);

export type Space = typeof space;
