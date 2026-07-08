import { baseTokens } from './base.ts';
import { lightOverrides } from './light.ts';
import { darkOverrides } from './dark.ts';
import { colors } from './colors.ts';
import { surfaces } from './surfaces.ts';

/**
 * Combined token shape. Consumers that need theme resolution should
 * import baseTokens + lightOverrides/darkOverrides directly, or use
 * `cssVars(theme)` from @threadplane/ui-react.
 *
 * `tokens.colors` and `tokens.surfaces` are backwards-compat aliases for
 * the light-theme resolved values — existing website consumers (light-only)
 * keep working without modification.
 */
export const tokens = Object.freeze({
  ...baseTokens,
  colors,
  surfaces,
  light: lightOverrides,
  dark: darkOverrides,
} as const);

export type Tokens = typeof tokens;

export { baseTokens } from './base.ts';
export { lightOverrides } from './light.ts';
export { darkOverrides } from './dark.ts';
