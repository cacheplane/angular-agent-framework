import { colors } from './colors';
import { glass } from './glass';
import { gradient } from './gradients';
import { glow } from './glow';
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
  glass,
  gradient,
  glow,
  typography,
  surfaces,
  shadows,
  radius,
  space,
} as const;

export type Tokens = typeof tokens;
