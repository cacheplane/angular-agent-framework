import { baseTokens } from './base';

/**
 * Theme-variant tokens resolved for the light theme.
 * Preserves the current production light palette exactly.
 */
export const lightOverrides = Object.freeze({
  // Surfaces (was libs/design-tokens/src/lib/surfaces.ts)
  canvas: '#fafbfc',
  surface: '#ffffff',
  surfaceTinted: '#f4f6fb',
  surfaceDim: '#eef1f7',
  border: '#e6e8ee',
  borderStrong: '#d2d6e0',

  // Text
  textPrimary: '#1a1a2e',
  textSecondary: '#555770',
  textMuted: '#8b8fa3',
  textInverted: '#ffffff',

  // Legacy surface aliases
  bg: '#f8f9fc',
  sidebarBg: 'rgba(255, 255, 255, 0.45)',

  // Semantic accent maps to the navy brand color
  accent: baseTokens.brand.accent,
  accentHover: '#003070',
  accentGlow: 'rgba(0, 64, 144, 0.2)',
  accentBorder: 'rgba(0, 64, 144, 0.15)',
  accentBorderHover: 'rgba(0, 64, 144, 0.3)',
  accentSurface: 'rgba(0, 64, 144, 0.06)',
} as const);

export type LightOverrides = typeof lightOverrides;
