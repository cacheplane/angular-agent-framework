import {
  colors,
  glass,
  gradient,
  glow,
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

  // Glass (legacy — removed in Phase 8.3)
  '--ds-glass-bg': glass.bg,
  '--ds-glass-bg-hover': glass.bgHover,
  '--ds-glass-blur': glass.blur,
  '--ds-glass-border': glass.border,
  '--ds-glass-shadow': glass.shadow,

  // Gradients (legacy — removed in Phase 8.3)
  '--ds-gradient-warm': gradient.warm,
  '--ds-gradient-cool': gradient.cool,
  '--ds-gradient-cool-light': gradient.coolLight,
  '--ds-gradient-bg-flow': gradient.bgFlow,

  // Glow (legacy — removed in Phase 8.3)
  '--ds-glow-hero': glow.hero,
  '--ds-glow-demo': glow.demo,
  '--ds-glow-card': glow.card,
  '--ds-glow-border': glow.border,
  '--ds-glow-button': glow.button,

  // Typography
  '--ds-font-serif': typography.fontSerif,
  '--ds-font-sans': typography.fontSans,
  '--ds-font-mono': typography.fontMono,

  // Surfaces (Phase 1)
  '--ds-canvas': surfaces.canvas,
  '--ds-surface': surfaces.surface,
  '--ds-surface-tinted': surfaces.surfaceTinted,
  '--ds-surface-dim': surfaces.surfaceDim,
  '--ds-border': surfaces.border,
  '--ds-border-strong': surfaces.borderStrong,

  // Shadows (Phase 1)
  '--ds-shadow-sm': shadows.sm,
  '--ds-shadow-md': shadows.md,
  '--ds-shadow-lg': shadows.lg,
  '--ds-shadow-focus': shadows.focus,

  // Radii (Phase 1)
  '--ds-radius-sm': radius.sm,
  '--ds-radius-md': radius.md,
  '--ds-radius-lg': radius.lg,
  '--ds-radius-xl': radius.xl,
  '--ds-radius-full': radius.full,

  // Space (Phase 1)
  '--ds-section-y': space.sectionY,
  '--ds-section-y-tight': space.sectionYTight,
  '--ds-container-x': space.containerX,
  '--ds-container-max': space.containerMax,
} as const;

export type CssVars = typeof cssVars;
