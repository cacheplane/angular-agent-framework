import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { cssVars } from './css-vars';

const TOKENS_CSS = resolve(__dirname, 'tokens.css');

/**
 * `cssVars('light')` and the generated tokens.css both emit the `--ds-*`
 * namespace from the same TypeScript sources, as two independently maintained
 * lists. Nothing structurally prevents them drifting, so this asserts they
 * agree.
 *
 * tokens.css is a superset: it also carries the type scale (`--ds-h1-size`,
 * ...), which `cssVars` does not emit. That direction is allowed; the reverse
 * is not.
 */
function parseDsVars(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/^\s*(--ds-[a-z0-9-]+):\s*(.+?);\s*$/gm)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

describe('--ds-* emitters agree', () => {
  const fromCss = parseDsVars(readFileSync(TOKENS_CSS, 'utf-8'));
  const fromFn = cssVars('light') as Record<string, string>;

  it('parses a non-trivial number of names from each source', () => {
    expect(Object.keys(fromCss).length).toBeGreaterThan(30);
    expect(Object.keys(fromFn).length).toBeGreaterThan(30);
  });

  it('tokens.css defines every name cssVars(light) emits', () => {
    const missing = Object.keys(fromFn).filter((k) => !(k in fromCss));
    expect(missing).toEqual([]);
  });

  it('agrees on every shared value', () => {
    const mismatches = Object.keys(fromFn)
      .filter((k) => k in fromCss && fromCss[k] !== String(fromFn[k]))
      .map((k) => `${k}: css=${fromCss[k]} fn=${String(fromFn[k])}`);
    expect(mismatches).toEqual([]);
  });

  /**
   * Brand colors are the one case where the "tokens.css may be a superset"
   * rule above does NOT apply. They are theme-invariant identity markers
   * (base.ts's `brand` block) with no type-scale-style reason to exist in
   * tokens.css but not cssVars() — unlike the type scale, dropping one from
   * cssVars() is never legitimate. This list is scoped to just the five
   * aviation-yellow brand names (not the full CONSUMER_REFERENCED list in
   * ds-var-contract.spec.ts, which also covers theme-variant and type-scale
   * names that are allowed to be tokens.css-only).
   *
   * A reviewer proved this hole by mutation: deleting these five entries
   * from css-vars.ts left the full suite green before this test existed.
   */
  const BRAND_NAMES = [
    '--ds-signal',
    '--ds-signal-strong',
    '--ds-scope',
    '--ds-alert',
    '--ds-ink',
  ] as const;

  it('cssVars(light) emits every brand color name', () => {
    const missing = BRAND_NAMES.filter((n) => !(n in fromFn));
    expect(missing).toEqual([]);
  });
});
