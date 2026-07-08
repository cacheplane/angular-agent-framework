/**
 * @deprecated Backwards-compat export. New code should resolve theme-aware
 * surface tokens via `cssVars(theme)` (in @threadplane/ui-react), or import
 * `lightOverrides` / `darkOverrides` from this package directly.
 *
 * Preserves the original `surfaces` export shape by re-exporting the
 * light-theme resolved values. Existing website consumers (light-only)
 * continue to work without modification.
 */
import { lightOverrides } from './light.js';

export const surfaces = Object.freeze({
  canvas: lightOverrides.canvas,
  surface: lightOverrides.surface,
  surfaceTinted: lightOverrides.surfaceTinted,
  surfaceDim: lightOverrides.surfaceDim,
  border: lightOverrides.border,
  borderStrong: lightOverrides.borderStrong,
} as const);

export type Surfaces = typeof surfaces;
