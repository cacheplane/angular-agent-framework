/**
 * Glassmorphism tokens — frosted glass panel treatment.
 *
 * Apply as: background + backdrop-filter + border + box-shadow.
 */
export const glass = Object.freeze({
  /** Default panel fill — 45% white */
  bg: 'rgba(255, 255, 255, 0.45)',
  /** Hover/active panel fill — 55% white */
  bgHover: 'rgba(255, 255, 255, 0.55)',
  /** Backdrop blur amount */
  blur: '16px',
  /** Subtle white edge for glass panels */
  border: 'rgba(255, 255, 255, 0.6)',
  /** Soft diffuse shadow */
  shadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
} as const);

export type Glass = typeof glass;
