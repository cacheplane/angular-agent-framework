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
});
