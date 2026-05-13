import { baseTokens } from './base';

/**
 * Theme-variant tokens resolved for the dark theme.
 * Brand-blue undertone palette: #0e1117 content, #161b25 sidebar, #23293a borders.
 */
export const darkOverrides = Object.freeze({
  // Surfaces
  canvas: '#0e1117',
  surface: '#161b25',
  surfaceTinted: '#1c2230',
  surfaceDim: '#0b0e15',
  border: '#23293a',
  borderStrong: '#2f3648',

  // Text
  textPrimary: '#e8e9eb',
  textSecondary: '#a0a4ad',
  textMuted: '#6b6f7a',
  textInverted: '#0e1117',

  // Legacy surface aliases
  bg: '#0e1117',
  sidebarBg: 'rgba(22, 27, 37, 0.65)',

  // Semantic accent maps to the bright-blue brand color (readable on dark surfaces)
  accent: baseTokens.brand.accentLight,
  accentHover: '#8dd4ff',
  accentGlow: 'rgba(100, 195, 253, 0.25)',
  accentBorder: 'rgba(100, 195, 253, 0.2)',
  accentBorderHover: 'rgba(100, 195, 253, 0.35)',
  accentSurface: 'rgba(100, 195, 253, 0.08)',
} as const);

export type DarkOverrides = typeof darkOverrides;
