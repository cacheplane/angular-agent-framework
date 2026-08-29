import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const TOKENS_CSS = resolve(__dirname, 'tokens.css');

/**
 * The `--ds-*` names that cockpit and example apps actually reference today.
 *
 * They all reference them with fallbacks and nothing imports tokens.css yet,
 * so dropping a name causes no immediate breakage — it would just silently
 * pin those apps to their fallback colours forever. Hence this list.
 *
 * Derived from:
 *   grep -rhoE -- "--ds-[a-z0-9-]+" cockpit examples apps | sort -u
 * intersected with the names tokens.css defined before it came under the
 * generator. Add to this list when a consumer starts using a new name.
 */
const CONSUMER_REFERENCED = [
  '--ds-accent',
  '--ds-accent-border',
  '--ds-accent-glow',
  '--ds-accent-hover',
  '--ds-accent-surface',
  '--ds-border',
  '--ds-border-strong',
  '--ds-canvas',
  '--ds-font-mono',
  '--ds-font-sans',
  '--ds-font-serif',
  '--ds-radius-lg',
  '--ds-radius-md',
  '--ds-radius-sm',
  '--ds-radius-xl',
  '--ds-shadow-lg',
  '--ds-shadow-md',
  '--ds-surface',
  '--ds-surface-dim',
  '--ds-surface-tinted',
  '--ds-text-inverted',
  '--ds-text-muted',
  '--ds-text-primary',
  '--ds-text-secondary',
] as const;

function definedNames(css: string): Set<string> {
  return new Set([...css.matchAll(/^\s*(--ds-[a-z0-9-]+):/gm)].map((m) => m[1]));
}

describe('--ds-* consumer contract', () => {
  const defined = definedNames(readFileSync(TOKENS_CSS, 'utf-8'));

  it('parses a non-trivial number of names (guards a regex that matches nothing)', () => {
    expect(defined.size).toBeGreaterThan(20);
  });

  it('defines every --ds-* name a cockpit or example app references', () => {
    const missing = CONSUMER_REFERENCED.filter((n) => !defined.has(n));
    expect(missing).toEqual([]);
  });
});
