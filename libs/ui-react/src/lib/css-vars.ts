import {
  colors,
  typography,
  surfaces,
  shadows,
  radius,
  space,
} from '@ngaf/design-tokens';

/**
 * CSS custom properties derived from design tokens.
 * Apply to :root or a container element so Tailwind can reference them.
 */
export const cssVars = {
  // Colors
  '--ds-bg': colors.bg,
  '--ds-accent': colors.accent,
  '--ds-accent-hover': colors.accentHover,
  '--ds-accent-light': colors.accentLight,
  '--ds-accent-glow': colors.accentGlow,
  '--ds-accent-border': colors.accentBorder,
  '--ds-accent-border-hover': colors.accentBorderHover,
  '--ds-accent-surface': colors.accentSurface,
  '--ds-text-primary': colors.textPrimary,
  '--ds-text-secondary': colors.textSecondary,
  '--ds-text-muted': colors.textMuted,
  '--ds-text-inverted': colors.textInverted,
  '--ds-sidebar-bg': colors.sidebarBg,
  '--ds-angular-red': colors.angularRed,

  // Typography
  '--ds-font-serif': typography.fontSerif,
  '--ds-font-sans': typography.fontSans,
  '--ds-font-mono': typography.fontMono,

  // Surfaces
  '--ds-canvas': surfaces.canvas,
  '--ds-surface': surfaces.surface,
  '--ds-surface-tinted': surfaces.surfaceTinted,
  '--ds-surface-dim': surfaces.surfaceDim,
  '--ds-border': surfaces.border,
  '--ds-border-strong': surfaces.borderStrong,

  // Shadows
  '--ds-shadow-sm': shadows.sm,
  '--ds-shadow-md': shadows.md,
  '--ds-shadow-lg': shadows.lg,
  '--ds-shadow-focus': shadows.focus,

  // Radii
  '--ds-radius-sm': radius.sm,
  '--ds-radius-md': radius.md,
  '--ds-radius-lg': radius.lg,
  '--ds-radius-xl': radius.xl,
  '--ds-radius-full': radius.full,

  // Space
  '--ds-section-y': space.sectionY,
  '--ds-section-y-tight': space.sectionYTight,
  '--ds-container-x': space.containerX,
  '--ds-container-max': space.containerMax,
} as const;

export type CssVars = typeof cssVars;
