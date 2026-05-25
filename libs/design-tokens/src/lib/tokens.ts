import { baseTokens } from './base';
import { lightOverrides } from './light';
import { darkOverrides } from './dark';
import { colors } from './colors';
import { surfaces } from './surfaces';

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

export { baseTokens } from './base';
export { lightOverrides } from './light';
export { darkOverrides } from './dark';
