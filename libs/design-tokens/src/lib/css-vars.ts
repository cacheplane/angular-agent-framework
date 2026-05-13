import { baseTokens } from './base';
import { lightOverrides } from './light';
import { darkOverrides } from './dark';
import type { Theme } from './theme';

const overridesByTheme = {
  light: lightOverrides,
  dark: darkOverrides,
} as const;

/**
 * Resolve design tokens to a flat map of `--ds-*` CSS custom properties
 * for the given theme. Apply to `<html>` (or any container) via inline
 * style or by iterating the entries and calling
 * `element.style.setProperty(key, value)`.
 */
export function cssVars(theme: Theme) {
  const t = overridesByTheme[theme];
  const { brand, typography, space, radius, shadows } = baseTokens;

  return {
    // Surfaces (theme-variant)
    '--ds-canvas': t.canvas,
    '--ds-surface': t.surface,
    '--ds-surface-tinted': t.surfaceTinted,
    '--ds-surface-dim': t.surfaceDim,
    '--ds-border': t.border,
    '--ds-border-strong': t.borderStrong,

    // Text (theme-variant)
    '--ds-text-primary': t.textPrimary,
    '--ds-text-secondary': t.textSecondary,
    '--ds-text-muted': t.textMuted,
    '--ds-text-inverted': t.textInverted,

    // Legacy surface aliases
    '--ds-bg': t.bg,
    '--ds-sidebar-bg': t.sidebarBg,

    // Accent family (theme-variant — semantic accent points to navy in light, bright-blue in dark)
    '--ds-accent': t.accent,
    '--ds-accent-hover': t.accentHover,
    '--ds-accent-glow': t.accentGlow,
    '--ds-accent-border': t.accentBorder,
    '--ds-accent-border-hover': t.accentBorderHover,
    '--ds-accent-surface': t.accentSurface,

    // Raw brand colors (invariant)
    '--ds-accent-light': brand.accentLight,
    '--ds-angular-red': brand.angularRed,
    '--ds-render-green': brand.renderGreen,
    '--ds-chat-purple': brand.chatPurple,

    // Typography (invariant)
    '--ds-font-serif': typography.fontSerif,
    '--ds-font-sans': typography.fontSans,
    '--ds-font-mono': typography.fontMono,

    // Shadows (invariant)
    '--ds-shadow-sm': shadows.sm,
    '--ds-shadow-md': shadows.md,
    '--ds-shadow-lg': shadows.lg,
    '--ds-shadow-focus': shadows.focus,

    // Radii (invariant)
    '--ds-radius-sm': radius.sm,
    '--ds-radius-md': radius.md,
    '--ds-radius-lg': radius.lg,
    '--ds-radius-xl': radius.xl,
    '--ds-radius-full': radius.full,

    // Spacing (invariant)
    '--ds-section-y': space.sectionY,
    '--ds-section-y-tight': space.sectionYTight,
    '--ds-container-x': space.containerX,
    '--ds-container-max': space.containerMax,
  } as const;
}

export type CssVars = ReturnType<typeof cssVars>;
