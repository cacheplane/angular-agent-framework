import { colors } from './colors';
import { typography } from './typography';
import { surfaces } from './surfaces';
import { shadows } from './shadows';
import { radius } from './radius';
import { space } from './space';

/**
 * Combined design tokens object.
 * Useful for passing all tokens at once.
 * Prefer individual imports for tree-shaking.
 */
export const tokens = {
  colors,
  typography,
  surfaces,
  shadows,
  radius,
  space,
} as const;

export type Tokens = typeof tokens;
