/**
 * @deprecated Backwards-compat export. New code should resolve theme-aware
 * tokens via `cssVars(theme)` (in @threadplane/ui-react), or import `lightOverrides`
 * / `darkOverrides` from this package directly.
 *
 * This shape preserves the original `colors` export by merging the
 * theme-invariant brand colors (`baseTokens.brand`) with the light-theme
 * resolved values from `lightOverrides`. Existing website consumers
 * (which are light-only) continue to work without modification.
 */
import { baseTokens } from './base.js';
import { lightOverrides } from './light.js';

export const colors = Object.freeze({
  // Theme-invariant brand identity
  accent: baseTokens.brand.accent,
  accentLight: baseTokens.brand.accentLight,
  angularRed: baseTokens.brand.angularRed,
  renderGreen: baseTokens.brand.renderGreen,
  chatPurple: baseTokens.brand.chatPurple,
  // Light-theme resolved values (preserves the original colors.* shape)
  bg: lightOverrides.bg,
  accentHover: lightOverrides.accentHover,
  accentGlow: lightOverrides.accentGlow,
  accentBorder: lightOverrides.accentBorder,
  accentBorderHover: lightOverrides.accentBorderHover,
  accentSurface: lightOverrides.accentSurface,
  textInverted: lightOverrides.textInverted,
  textPrimary: lightOverrides.textPrimary,
  textSecondary: lightOverrides.textSecondary,
  textMuted: lightOverrides.textMuted,
  sidebarBg: lightOverrides.sidebarBg,
} as const);

export type Colors = typeof colors;
