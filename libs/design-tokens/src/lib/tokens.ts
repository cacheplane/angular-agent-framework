import { baseTokens } from './base.js';
import { lightOverrides } from './light.js';
import { darkOverrides } from './dark.js';
import { colors } from './colors.js';
import { surfaces } from './surfaces.js';

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

export { baseTokens } from './base.js';
export { lightOverrides } from './light.js';
export { darkOverrides } from './dark.js';
