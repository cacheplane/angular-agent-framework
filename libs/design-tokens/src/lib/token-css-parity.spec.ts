import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { tokens } from './tokens';

const THEME_CSS = resolve(__dirname, 'theme.css');

/**
 * Every leaf in the `tokens` tree must either map to a CSS custom property in
 * theme.css (holding an identical value) or appear in EXCLUDED with a reason.
 *
 * This is the premise the inline-style migration rests on: `tokens.X.Y` and
 * `var(--z)` are interchangeable. Do not weaken this test to make a new token
 * pass — add the token to the generator, or exclude it here with a comment
 * saying why it can never have a var.
 */
const CSS_VAR_BY_PATH: Record<string, string> = {
  // Brand (theme-invariant)
  'brand.accent': '--color-accent',
  'brand.accentLight': '--color-accent-light',
  'brand.angularRed': '--color-angular-red',
  'brand.renderGreen': '--color-render-green',
  'brand.chatPurple': '--color-chat-purple',

  // Font families
  'typography.fontSerif': '--font-garamond',
  'typography.fontSans': '--font-inter',
  'typography.fontMono': '--font-mono',

  // Type scale — size
  'typography.h1.size': '--text-h1',
  'typography.h2.size': '--text-h2',
  'typography.h3.size': '--text-h3',
  'typography.eyebrow.size': '--text-eyebrow',
  'typography.bodyLg.size': '--text-body-lg',
  'typography.body.size': '--text-body',
  'typography.caption.size': '--text-caption',

  // Type scale — line height
  'typography.h1.line': '--text-h1--line-height',
  'typography.h2.line': '--text-h2--line-height',
  'typography.h3.line': '--text-h3--line-height',
  'typography.eyebrow.line': '--text-eyebrow--line-height',
  'typography.bodyLg.line': '--text-body-lg--line-height',
  'typography.body.line': '--text-body--line-height',
  'typography.caption.line': '--text-caption--line-height',

  // Type scale — weight / tracking
  'typography.h3.weight': '--text-h3--font-weight',
  'typography.eyebrow.weight': '--text-eyebrow--font-weight',
  'typography.eyebrow.letterSpacing': '--text-eyebrow--letter-spacing',

  // Space scale
  'space.sectionY': '--spacing-section-y',
  'space.sectionYTight': '--spacing-section-y-tight',
  'space.containerX': '--spacing-container-x',
  'space.containerMax': '--container-page',

  // Radii
  'radius.sm': '--radius-sm',
  'radius.md': '--radius-md',
  'radius.lg': '--radius-lg',
  'radius.xl': '--radius-xl',
  'radius.full': '--radius-full',

  // Shadows
  'shadows.sm': '--shadow-sm',
  'shadows.md': '--shadow-md',
  'shadows.lg': '--shadow-lg',
  'shadows.focus': '--shadow-focus',

  // Light-resolved colour aliases (what the website actually imports)
  'colors.accent': '--color-accent',
  'colors.accentLight': '--color-accent-light',
  'colors.angularRed': '--color-angular-red',
  'colors.renderGreen': '--color-render-green',
  'colors.chatPurple': '--color-chat-purple',
  'colors.bg': '--color-bg',
  'colors.accentHover': '--color-accent-hover',
  'colors.accentGlow': '--color-accent-glow',
  'colors.accentBorder': '--color-accent-border',
  'colors.accentBorderHover': '--color-accent-border-hover',
  'colors.accentSurface': '--color-accent-surface',
  'colors.textInverted': '--color-text-inverted',
  'colors.textPrimary': '--color-text-primary',
  'colors.textSecondary': '--color-text-secondary',
  'colors.textMuted': '--color-text-muted',
  'colors.sidebarBg': '--color-sidebar-bg',

  // Light-resolved surface aliases
  'surfaces.canvas': '--color-canvas',
  'surfaces.surface': '--color-surface',
  'surfaces.surfaceTinted': '--color-surface-tinted',
  'surfaces.surfaceDim': '--color-surface-dim',
  'surfaces.border': '--color-border',
  'surfaces.borderStrong': '--color-border-strong',
};

/** Leaves that intentionally have no CSS var, with the reason. */
const EXCLUDED: ReadonlyArray<{ prefix: string; why: string }> = [
  {
    prefix: 'typography.h1.family',
    why: 'value is already `var(--font-garamond)` — a var about a var buys nothing',
  },
  { prefix: 'typography.h2.family', why: 'see h1.family' },
  { prefix: 'typography.h3.family', why: 'see h1.family' },
  { prefix: 'typography.eyebrow.family', why: 'see h1.family' },
  { prefix: 'typography.bodyLg.family', why: 'see h1.family' },
  { prefix: 'typography.body.family', why: 'see h1.family' },
  { prefix: 'typography.caption.family', why: 'see h1.family' },
  {
    prefix: 'typography.eyebrow.transform',
    why: 'plain `text-transform: uppercase` keyword; Tailwind --text-* has no transform sub-key',
  },
  {
    prefix: 'light.',
    why: 'theme-resolution source; consumed via the colors/surfaces aliases which are mapped',
  },
  { prefix: 'dark.', why: 'dark theme is not emitted — the website is light-only' },
];

function parseCssVars(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/^\s*(--[a-z0-9-]+):\s*(.+?);\s*$/gm)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/** Flatten the frozen token tree to `dotted.path -> primitive value`. */
function flatten(node: unknown, prefix = ''): Array<[string, string]> {
  if (node === null || typeof node !== 'object') {
    return [[prefix, String(node)]];
  }
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

const leaves = flatten(tokens);
const cssVars = parseCssVars(readFileSync(THEME_CSS, 'utf-8'));
const isExcluded = (path: string) =>
  EXCLUDED.some((e) => path === e.prefix || path.startsWith(e.prefix));

describe('token ↔ CSS var parity', () => {
  it('finds a non-trivial number of token leaves (guards against a walker that visits nothing)', () => {
    expect(leaves.length).toBeGreaterThan(60);
  });

  it('parses a non-trivial number of vars from theme.css', () => {
    expect(Object.keys(cssVars).length).toBeGreaterThan(30);
  });

  it('maps or explicitly excludes every token leaf', () => {
    const unaccounted = leaves
      .map(([path]) => path)
      .filter((path) => !CSS_VAR_BY_PATH[path] && !isExcluded(path));
    expect(unaccounted).toEqual([]);
  });

  // The `light.` exclusion above rests on every light-theme value being
  // reachable through the `colors.*` / `surfaces.*` aliases, which ARE mapped.
  // Nothing enforced that, so a new token in light.ts could slip through the
  // exclusion unmapped. This closes it.
  it('every light.* value is reachable through a mapped colors/surfaces alias', () => {
    const aliased = new Map(
      leaves
        .filter(([p]) => p.startsWith('colors.') || p.startsWith('surfaces.'))
        .map(([, v]) => [v, true]),
    );
    const unreachable = leaves
      .filter(([p]) => p.startsWith('light.'))
      .filter(([, v]) => !aliased.has(v))
      .map(([p]) => p);
    expect(unreachable).toEqual([]);
  });

  it.each(Object.entries(CSS_VAR_BY_PATH))(
    '%s has an identical value in theme.css as %s',
    (path, varName) => {
      const leaf = leaves.find(([p]) => p === path);
      if (!leaf) throw new Error(`token path ${path} does not exist`);
      expect(cssVars[varName], `${varName} missing from theme.css`).toBeDefined();
      expect(cssVars[varName]).toBe(leaf[1]);
    },
  );
});
