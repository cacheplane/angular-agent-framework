#!/usr/bin/env tsx
/**
 * Generates libs/design-tokens/src/lib/theme.css from the TypeScript
 * token sources. Tailwind v4 reads `@theme { --color-*, --font-*, ... }`
 * to generate utility classes; this script emits those tokens with the
 * values pulled from `lightOverrides` + `baseTokens`.
 *
 * The output is committed to the repo (not gitignored) so consumers
 * can import it directly. A drift-guard test re-runs this generator
 * and diffs against the committed file to catch stale output.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseTokens } from '../src/lib/base';
import { lightOverrides } from '../src/lib/light';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_PATH = resolve(HERE, '..', 'src', 'lib', 'theme.css');

const HEADER = `/*
 * @threadplane/design-tokens/theme.css
 *
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   pnpm nx run design-tokens:generate-theme-css
 *
 * Source of truth:
 *   - libs/design-tokens/src/lib/light.ts
 *   - libs/design-tokens/src/lib/base.ts
 *
 * Drift between this file and the TS sources is caught by
 * generate-theme-css.spec.ts at test time.
 */
`;

function buildThemeBlock(): string {
  const { typography, radius, shadows, brand } = baseTokens;

  const lines: string[] = ['@theme {'];

  // Colors — surface family
  lines.push('  /* Surfaces */');
  lines.push(`  --color-canvas: ${lightOverrides.canvas};`);
  lines.push(`  --color-surface: ${lightOverrides.surface};`);
  lines.push(`  --color-surface-tinted: ${lightOverrides.surfaceTinted};`);
  lines.push(`  --color-surface-dim: ${lightOverrides.surfaceDim};`);
  lines.push(`  --color-border: ${lightOverrides.border};`);
  lines.push(`  --color-border-strong: ${lightOverrides.borderStrong};`);

  // Colors — text
  lines.push('');
  lines.push('  /* Text */');
  lines.push(`  --color-text-primary: ${lightOverrides.textPrimary};`);
  lines.push(`  --color-text-secondary: ${lightOverrides.textSecondary};`);
  lines.push(`  --color-text-muted: ${lightOverrides.textMuted};`);
  lines.push(`  --color-text-inverted: ${lightOverrides.textInverted};`);

  // Colors — legacy aliases
  lines.push('');
  lines.push('  /* Legacy surface aliases */');
  lines.push(`  --color-bg: ${lightOverrides.bg};`);
  lines.push(`  --color-sidebar-bg: ${lightOverrides.sidebarBg};`);

  // Colors — accent family
  lines.push('');
  lines.push('  /* Accent family */');
  lines.push(`  --color-accent: ${lightOverrides.accent};`);
  lines.push(`  --color-accent-hover: ${lightOverrides.accentHover};`);
  lines.push(`  --color-accent-glow: ${lightOverrides.accentGlow};`);
  lines.push(`  --color-accent-border: ${lightOverrides.accentBorder};`);
  lines.push(`  --color-accent-border-hover: ${lightOverrides.accentBorderHover};`);
  lines.push(`  --color-accent-surface: ${lightOverrides.accentSurface};`);

  // Colors — brand
  lines.push('');
  lines.push('  /* Brand */');
  lines.push(`  --color-accent-light: ${brand.accentLight};`);
  lines.push(`  --color-angular-red: ${brand.angularRed};`);
  lines.push(`  --color-render-green: ${brand.renderGreen};`);
  lines.push(`  --color-chat-purple: ${brand.chatPurple};`);

  // Fonts
  lines.push('');
  lines.push('  /* Fonts */');
  lines.push(`  --font-garamond: ${typography.fontSerif};`);
  lines.push(`  --font-inter: ${typography.fontSans};`);
  lines.push(`  --font-mono: ${typography.fontMono};`);

  // Radii
  lines.push('');
  lines.push('  /* Radii */');
  lines.push(`  --radius-sm: ${radius.sm};`);
  lines.push(`  --radius-md: ${radius.md};`);
  lines.push(`  --radius-lg: ${radius.lg};`);
  lines.push(`  --radius-xl: ${radius.xl};`);
  lines.push(`  --radius-full: ${radius.full};`);

  // Shadows
  lines.push('');
  lines.push('  /* Shadows */');
  lines.push(`  --shadow-sm: ${shadows.sm};`);
  lines.push(`  --shadow-md: ${shadows.md};`);
  lines.push(`  --shadow-lg: ${shadows.lg};`);
  lines.push(`  --shadow-focus: ${shadows.focus};`);

  lines.push('}');
  return lines.join('\n') + '\n';
}

export function generateThemeCss(): string {
  return HEADER + buildThemeBlock();
}

function main() {
  const content = generateThemeCss();
  writeFileSync(OUTPUT_PATH, content);
  // eslint-disable-next-line no-console
  console.log(`wrote ${OUTPUT_PATH}`);
}

// Only run main when invoked directly (not when imported by tests)
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  main();
}
