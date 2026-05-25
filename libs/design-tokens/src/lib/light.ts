import { baseTokens } from './base';

/**
 * Theme-variant tokens resolved for the light theme.
 * Aligned with @threadplane/chat library's polished consumer aesthetic
 * (pure-white surfaces, near-black text, neutral grays) so embedded
 * chat surfaces visually unify with cockpit chrome and the marketing
 * website.
 */
export const lightOverrides = Object.freeze({
  // Surfaces
  canvas: 'rgb(255, 255, 255)',
  surface: 'rgb(255, 255, 255)',
  surfaceTinted: 'rgb(251, 251, 251)',
  surfaceDim: 'rgb(245, 245, 245)',
  border: 'rgb(229, 229, 229)',
  borderStrong: 'rgb(200, 200, 200)',

  // Text
  textPrimary: 'rgb(28, 28, 28)',
  textSecondary: 'rgb(70, 70, 70)',
  textMuted: 'rgb(115, 115, 115)',
  textInverted: 'rgb(255, 255, 255)',

  // Legacy surface aliases
  bg: 'rgb(255, 255, 255)',
  sidebarBg: 'rgba(255, 255, 255, 0.45)',

  // Semantic accent maps to the navy brand color (unchanged — cockpit identity)
  accent: baseTokens.brand.accent,
  accentHover: '#003070',
  accentGlow: 'rgba(0, 64, 144, 0.2)',
  accentBorder: 'rgba(0, 64, 144, 0.15)',
  accentBorderHover: 'rgba(0, 64, 144, 0.3)',
  accentSurface: 'rgba(0, 64, 144, 0.06)',
} as const);

export type LightOverrides = typeof lightOverrides;
