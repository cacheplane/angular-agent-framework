/**
 * Elevation shadows for the marketing surface.
 *
 * `sm`/`md`/`lg` form a three-step elevation scale. `focus` is the
 * keyboard focus ring used on interactive primitives.
 */
export const shadows = Object.freeze({
  /** Subtle — default card */
  sm: '0 1px 2px rgba(15, 23, 41, 0.04), 0 1px 1px rgba(15, 23, 41, 0.03)',
  /** Moderate — hovered card, dropdown */
  md: '0 4px 12px rgba(15, 23, 41, 0.06), 0 2px 4px rgba(15, 23, 41, 0.04)',
  /** Strong — floating elements, hero collage */
  lg: '0 12px 32px rgba(15, 23, 41, 0.08), 0 4px 8px rgba(15, 23, 41, 0.05)',
  /** Keyboard focus ring */
  focus: '0 0 0 3px rgba(0, 64, 144, 0.25)',
} as const);

export type Shadows = typeof shadows;
