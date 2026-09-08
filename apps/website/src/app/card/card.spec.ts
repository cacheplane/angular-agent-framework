import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARD, MIN_READABLE_PX } from './tokens';
import { alt } from '../opengraph-image';
import { HERO_SUBHEAD, PRIMARY_TAGLINE } from '../../lib/positioning';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const THEME_CSS = join(REPO_ROOT, 'libs', 'design-tokens', 'src', 'lib', 'theme.css');

/** `rgb(28, 28, 28)` → `#1c1c1c`. Values in theme.css use either form. */
function toHex(value: string): string {
  const rgb = value.match(/rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)/u);
  if (!rgb) return value.trim().toLowerCase();
  return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

function tokenValue(name: string): string {
  const css = readFileSync(THEME_CSS, 'utf8');
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`, 'u'));
  if (!match) throw new Error(`token --${name} not found in theme.css`);
  return toHex(match[1]);
}

describe('card tokens', () => {
  /**
   * Satori cannot read CSS variables, so the card palette is a hand-copied
   * snapshot of the light design tokens. A snapshot with nothing checking it
   * is a snapshot that goes stale silently — the card would keep rendering,
   * in last season's colours, and only a human comparing a share preview to
   * the live site would ever notice.
   */
  it.each([
    ['ground', CARD.ground, 'color-surface-tinted'],
    ['dim', CARD.dim, 'color-surface-dim'],
    ['ink', CARD.ink, 'color-text-primary'],
    ['inkSecondary', CARD.inkSecondary, 'color-text-secondary'],
    ['inkMuted', CARD.inkMuted, 'color-text-muted'],
    ['border', CARD.border, 'color-border'],
    ['borderStrong', CARD.borderStrong, 'color-border-strong'],
    ['accent', CARD.accent, 'color-accent'],
  ])('%s still matches the design token', (_label, resolved, token) => {
    expect(resolved.toLowerCase()).toBe(tokenValue(token));
  });
});

describe('card fonts', () => {
  /**
   * These are read off disk at render time. If one goes missing the card does
   * not fail — `satoriFonts` drops it and Satori falls back — so a deleted or
   * unbuilt face is invisible until someone looks at a card and finds the
   * mono eyebrow set in Satori's fallback. Assert they exist instead.
   */
  it.each([
    'ArchivoBlack-Regular.ttf',
    'Archivo-Regular.ttf',
    'Archivo-SemiBold.ttf',
    'JetBrainsMono-Bold.ttf',
  ])('%s is bundled', (name) => {
    const stat = statSync(join(__dirname, 'fonts', name));
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBeGreaterThan(10_000);
  });

  it('ships static TTFs, not variable ones', () => {
    // Satori throws "Cannot read properties of undefined (reading '256')" on a
    // variable font, which would 500 the request-time default card. The build
    // script strips `fvar`; this asserts the tag is absent from the file.
    const names = [
      'ArchivoBlack-Regular.ttf',
      'Archivo-Regular.ttf',
      'Archivo-SemiBold.ttf',
      'JetBrainsMono-Bold.ttf',
    ];
    for (const name of names) {
      const buf = readFileSync(join(__dirname, 'fonts', name));
      expect(buf.subarray(0, 2048).includes(Buffer.from('fvar'))).toBe(false);
    }
  });
});

describe('default card alt text', () => {
  it('describes the picture, and quotes the positioning copy rather than retyping it', () => {
    expect(alt).toContain(PRIMARY_TAGLINE);
    expect(alt).toContain(HERO_SUBHEAD);
    // The card's whole claim is that it shows the product stopping for a
    // human. Alt text that only names the product would leave a screen-reader
    // user with the marketing line and none of the evidence.
    expect(alt).toMatch(/Approve and Decline/u);
  });

  it('keeps a floor for readable type', () => {
    expect(MIN_READABLE_PX).toBeGreaterThanOrEqual(18);
  });
});
