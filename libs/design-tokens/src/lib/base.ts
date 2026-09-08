import { typography } from './typography.ts';
import { space } from './space.ts';
import { radius } from './radius.ts';
import { shadows } from './shadows.ts';

/**
 * The two ATC hues that each carry two token names. Hoisted so a repoint moves
 * both names at once — `signal` cannot drift from `accentLight`, nor `scope`
 * from `accent`.
 */
const AVIATION_YELLOW = '#FFAF00';
const SCOPE_NAVY = '#15253E';

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
    /** Scope navy — the ATC radar panel. The light-theme interactive ink. */
    accent: SCOPE_NAVY,
    /**
     * Aviation yellow. Fill only: 1.84:1 on white, so it is never a text or
     * icon colour on a light surface. Doubles as the dark-theme accent, where
     * it reaches 8.33:1 — dark.ts derives its accent from this name.
     */
    accentLight: AVIATION_YELLOW,
    /** Aviation yellow, by its intended name. Same value as accentLight. */
    signal: AVIATION_YELLOW,
    /** Frequency-strip amber. Full-bleed data strips only. */
    signalStrong: '#FFB700',
    /** Scope navy — dark grounds and data strips. */
    scope: SCOPE_NAVY,
    /** LIVE red-orange. 3.68:1, so status fills and large bold text only. */
    alert: '#FF3200',
    /** Near-black. Text on yellow, and the light-theme text primary. */
    ink: '#0A0A0A',
    /** Angular brand red — trademark colour, not ours to retheme */
    angularRed: '#DD0031',
    /** Render library green */
    renderGreen: '#1a7a40',
    /** Chat library purple */
    chatPurple: '#5a00c8',
  }),
} as const);

export type BaseTokens = typeof baseTokens;
