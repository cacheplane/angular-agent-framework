import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const TOKENS_CSS = resolve(__dirname, 'tokens.css');

/**
 * The `--ds-*` names this contract protects. Two categories, both guarded
 * the same way:
 *
 * 1. Names cockpit and example apps actually reference today. They all
 *    reference them with fallbacks and nothing imports tokens.css yet,
 *    so dropping a name causes no immediate breakage — it would just
 *    silently pin those apps to their fallback colours forever. Hence
 *    this list.
 *
 *    Derived from:
 *      grep -rhoE -- "--ds-[a-z0-9-]+" cockpit examples apps | sort -u
 *    intersected with the names tokens.css defined before it came under
 *    the generator. Add to this list when a consumer starts using a new
 *    name.
 *
 * 2. Names reserved ahead of their consumers: `--ds-signal`,
 *    `--ds-signal-strong`, `--ds-scope`, `--ds-alert`, `--ds-ink` are the
 *    aviation-yellow retheme's brand colors, and `--ds-font-display` /
 *    `--ds-font-diagram` are the retheme's font faces, replacing
 *    `--ds-font-serif` — a name this list previously guarded and the retheme
 *    retires. Its one surviving use is the fallback in workspace.css, behind
 *    `var(--font-display)` (see Task 5). A repo-wide grep finds ZERO
 *    references to any of the reserved names above outside
 *    libs/design-tokens/ as of 2026-09-07 — that is expected, not a mistake,
 *    because cockpit/example adoption has not landed yet. Do NOT remove them because the grep above comes up empty;
 *    they must stay guarded so the names are ready when a consumer needs
 *    them.
 */
const CONSUMER_REFERENCED = [
  '--ds-accent',
  '--ds-accent-border',
  '--ds-accent-glow',
  '--ds-accent-hover',
  '--ds-accent-surface',
  '--ds-alert',
  '--ds-border',
  '--ds-border-strong',
  '--ds-canvas',
  '--ds-font-diagram',
  '--ds-font-display',
  '--ds-font-mono',
  '--ds-font-sans',
  '--ds-ink',
  '--ds-radius-lg',
  '--ds-radius-md',
  '--ds-radius-sm',
  '--ds-radius-xl',
  '--ds-render-green',
  '--ds-scope',
  '--ds-shadow-lg',
  '--ds-shadow-md',
  '--ds-signal',
  '--ds-signal-strong',
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

/**
 * No consumer may reference a `--ds-*` name the generator does not define.
 *
 * The list above guards the other direction — that a name we know consumers
 * use does not vanish from tokens.css. It cannot catch the inverse, and the
 * inverse is what actually shipped during the 2026-09-07 aviation retheme:
 * `--ds-font-serif` was retired from the token sources while
 * workspace.css:26 still said `var(--font-display), var(--ds-font-serif)`.
 *
 * That failure mode is silent and worse than it looks. An undefined custom
 * property in a `font-family` list is invalid at computed-value time, so the
 * whole declaration is dropped and the element loses its font entirely —
 * there is no partial fallback to the first entry in the list.
 */
describe('no dangling --ds-* references', () => {
  /**
   * Pre-dates the retheme (already dangling at 218ac1c41) and is a real bug in
   * its own right: `background: var(--ds-surface-subtle)` with no fallback
   * resolves to nothing. Listed rather than hidden so it stays visible; remove
   * this entry when workspace.css:209 is fixed or the token is added.
   */
  const KNOWN_PRE_EXISTING = new Set(['--ds-surface-subtle']);

  const CONSUMER_ROOTS = ['libs/workspace-react', 'cockpit', 'examples', 'apps/website/src'];

  it('every --ds-* a consumer references is defined in tokens.css', () => {
    const repoRoot = resolve(__dirname, '../../../..');
    const defined = new Set(
      [...readFileSync(TOKENS_CSS, 'utf-8').matchAll(/^\s*(--ds-[a-z0-9-]+):/gm)].map((m) => m[1]),
    );

    const referenced = new Set<string>();
    for (const root of CONSUMER_ROOTS) {
      const dir = resolve(repoRoot, root);
      if (!existsSync(dir)) continue;
      // grep exits 1 when a directory simply has no matches, and execFileSync
      // throws on any non-zero status — so a clean directory would look like a
      // broken test rather than a passing one.
      let found = '';
      try {
        found = execFileSync(
          'grep',
          ['-rhoE', '--exclude-dir=node_modules', 'var\\(--ds-[a-z0-9-]+', dir],
          { encoding: 'utf-8' },
        );
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status !== 1) throw error;
      }
      for (const hit of found.split('\n')) {
        if (hit) referenced.add(hit.replace('var(', ''));
      }
    }

    expect(referenced.size).toBeGreaterThan(5);
    const dangling = [...referenced]
      .filter((name) => !defined.has(name) && !KNOWN_PRE_EXISTING.has(name))
      .sort();
    expect(dangling).toEqual([]);
  });
});
