/**
 * Elevation shadows for the marketing surface.
 *
 * `sm`/`md`/`lg` form a three-step elevation scale. `focus` is the
 * keyboard focus ring used on interactive primitives.
 */
export const shadows = Object.freeze({
  /** Subtle — default card */
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  /** Moderate — hovered card, dropdown */
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  /** Strong — floating elements, hero collage */
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  /** Keyboard focus ring (accent-tinted; unchanged) */
  focus: '0 0 0 3px rgba(0, 64, 144, 0.25)',
} as const);

export type Shadows = typeof shadows;
