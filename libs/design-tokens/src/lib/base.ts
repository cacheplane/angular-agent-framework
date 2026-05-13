import { typography } from './typography';
import { space } from './space';
import { radius } from './radius';
import { shadows } from './shadows';

/**
 * Theme-invariant tokens. Same values in light and dark.
 * Includes typography, spacing, radii, shadows, and brand colors that
 * are identity markers rather than surface roles.
 */
export const baseTokens = Object.freeze({
  typography,
  space,
  radius,
  shadows,
  brand: Object.freeze({
    /** LangGraph navy — used as the light-theme semantic accent */
    accent: '#004090',
    /** Bright sky blue — used as the dark-theme semantic accent */
    accentLight: '#64C3FD',
    /** Angular brand red */
    angularRed: '#DD0031',
    /** Render library green */
    renderGreen: '#1a7a40',
    /** Chat library purple */
    chatPurple: '#5a00c8',
  }),
} as const);

export type BaseTokens = typeof baseTokens;
