import { baseTokens } from './base.ts';

/**
 * Theme-variant tokens resolved for the dark theme.
 * Neutral-dark palette aligned to @threadplane/chat lib's dark aesthetic so embedded
 * chat surfaces unify with cockpit chrome (no iframe color seam).
 */
export const darkOverrides = Object.freeze({
  // Surfaces
  canvas: 'rgb(17, 17, 17)',
  surface: 'rgb(28, 28, 28)',
  surfaceTinted: 'rgb(44, 44, 44)',
  surfaceDim: 'rgb(10, 10, 10)',
  border: 'rgb(45, 45, 45)',
  borderStrong: 'rgb(60, 60, 60)',

  // Text
  textPrimary: 'rgb(245, 245, 245)',
  textSecondary: 'rgb(200, 200, 200)',
  textMuted: 'rgb(160, 160, 160)',
  textInverted: 'rgb(17, 17, 17)',

  // Legacy surface aliases
  bg: 'rgb(17, 17, 17)',
  sidebarBg: 'rgba(28, 28, 28, 0.65)',

  // Semantic accent maps to aviation yellow (8.33:1 on the dark ground).
  // `accent` derives from the brand token; the tints below must be re-derived
  // with it or they silently keep the previous hue.
  accent: baseTokens.brand.accentLight,
  accentHover: '#FFC233',
  accentGlow: 'rgba(255, 175, 0, 0.25)',
  accentBorder: 'rgba(255, 175, 0, 0.22)',
  accentBorderHover: 'rgba(255, 175, 0, 0.4)',
  accentSurface: 'rgba(255, 175, 0, 0.1)',
} as const);

export type DarkOverrides = typeof darkOverrides;
