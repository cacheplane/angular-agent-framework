/**
 * Surface tokens — backgrounds and borders for the marketing site.
 *
 * Replaces the older `bg`/`sidebarBg`/`glass` surfaces. Use these for any
 * new component; legacy components may still consume `colors.bg` until
 * the Phase 6 cleanup.
 */
export const surfaces = Object.freeze({
  /** Page background — near-white */
  canvas: '#fafbfc',
  /** Pure white — cards, frames, nav */
  surface: '#ffffff',
  /** Alternating section tint — slightly cool */
  surfaceTinted: '#f4f6fb',
  /** Stronger tint — pricing-card highlight, callouts */
  surfaceDim: '#eef1f7',
  /** Default 1px hairline */
  border: '#e6e8ee',
  /** Emphasized border — focused inputs, hovered cards */
  borderStrong: '#d2d6e0',
} as const);

export type Surfaces = typeof surfaces;
