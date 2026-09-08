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
  /**
   * Keyboard focus ring. Deliberately scope navy and NOT the signal yellow:
   * a yellow ring on a white page is 1.84:1 and effectively invisible.
   */
  focus: '0 0 0 3px rgba(21, 37, 62, 0.30)',
} as const);

export type Shadows = typeof shadows;
