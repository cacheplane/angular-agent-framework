import { colors, glass, gradient, glow, typography } from '@ngaf/design-tokens';

/**
 * CSS custom properties derived from design tokens.
 * Apply to :root or a container element so Tailwind can reference them.
 */
export const cssVars = {
  '--ds-bg': colors.bg,
  '--ds-accent': colors.accent,
  '--ds-accent-light': colors.accentLight,
  '--ds-accent-glow': colors.accentGlow,
  '--ds-accent-border': colors.accentBorder,
  '--ds-accent-border-hover': colors.accentBorderHover,
  '--ds-accent-surface': colors.accentSurface,
  '--ds-text-primary': colors.textPrimary,
  '--ds-text-secondary': colors.textSecondary,
  '--ds-text-muted': colors.textMuted,
  '--ds-sidebar-bg': colors.sidebarBg,
  '--ds-angular-red': colors.angularRed,
  '--ds-glass-bg': glass.bg,
  '--ds-glass-bg-hover': glass.bgHover,
  '--ds-glass-blur': glass.blur,
  '--ds-glass-border': glass.border,
  '--ds-glass-shadow': glass.shadow,
  '--ds-gradient-warm': gradient.warm,
  '--ds-gradient-cool': gradient.cool,
  '--ds-gradient-cool-light': gradient.coolLight,
  '--ds-gradient-bg-flow': gradient.bgFlow,
  '--ds-glow-hero': glow.hero,
  '--ds-glow-demo': glow.demo,
  '--ds-glow-card': glow.card,
  '--ds-glow-border': glow.border,
  '--ds-glow-button': glow.button,
  '--ds-font-serif': typography.fontSerif,
  '--ds-font-sans': typography.fontSans,
  '--ds-font-mono': typography.fontMono,
} as const;

export type CssVars = typeof cssVars;
