import { baseTokens } from './base';
import { lightOverrides } from './light';
import { darkOverrides } from './dark';

/**
 * Combined token shape for documentation and Storybook.
 * Consumers that need theme resolution should import baseTokens +
 * lightOverrides/darkOverrides directly, or use `cssVars(theme)` from
 * @ngaf/ui-react.
 */
export const tokens = Object.freeze({
  ...baseTokens,
  light: lightOverrides,
  dark: darkOverrides,
} as const);

export type Tokens = typeof tokens;

export { baseTokens } from './base';
export { lightOverrides } from './light';
export { darkOverrides } from './dark';
