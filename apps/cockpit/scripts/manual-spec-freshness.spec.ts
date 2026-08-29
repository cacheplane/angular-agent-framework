// SPDX-License-Identifier: MIT
//
// Tripwire for the `*.manual.ts` tier.
//
// Manual specs are live-LLM checks a human runs by hand: every cockpit
// playwright config matches `**/*.spec.ts`, so nothing executes these and CI
// can never notice when they drift. When this guard was written, 10 of 34 were
// asserting UI copy that existed nowhere in the repo — panel headings that had
// been renamed, and empty-state strings from sidebars that no longer exist.
//
// Running the specs themselves in CI isn't viable (real model, per-example dev
// server). What IS cheap is checking that everything they assert still exists
// in the source. That catches the rot this tier actually suffers — stale copy
// and dropped selectors — without booting anything.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', '.venv', '.next', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
    } else {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const allFiles = walk(join(REPO_ROOT, 'cockpit')).concat(walk(join(REPO_ROOT, 'libs')));
const manualSpecs = allFiles.filter((f) => f.endsWith('.manual.ts'));

/** Every source file a manual spec could legitimately be asserting against. */
const sourceCorpus = allFiles
  .filter((f) => /\.(ts|html|css)$/.test(f) && !f.endsWith('.manual.ts'))
  .map((f) => {
    try {
      return readFileSync(f, 'utf8');
    } catch {
      return '';
    }
  })
  .join('\n');

/** `text=Some copy` and `getByText('Some copy')` assertions. */
function assertedText(spec: string): string[] {
  const out = new Set<string>();
  for (const m of spec.matchAll(/text=([^'"`)]{4,80})/g)) out.add(m[1].trim());
  for (const m of spec.matchAll(/getByText\(\s*['"]([^'"]{4,80})['"]/g)) out.add(m[1].trim());
  return [...out];
}

/** `page.locator('some-element')` custom-element selectors. */
function assertedSelectors(spec: string): string[] {
  const out = new Set<string>();
  for (const m of spec.matchAll(/locator\(\s*['"]([a-z][a-z0-9]*(?:-[a-z0-9]+)+)['"]/g)) out.add(m[1]);
  return [...out];
}

describe('manual e2e specs stay in sync with the source', () => {
  it('finds the manual tier', () => {
    // Guards the guard: if the glob ever stops matching, every assertion below
    // would pass over an empty list and this file would be worthless.
    expect(manualSpecs.length).toBeGreaterThan(20);
  });

  it.each(manualSpecs.map((f) => [f.slice(REPO_ROOT.length + 1), f]))(
    '%s asserts only text that still exists',
    (_label, file) => {
      const spec = readFileSync(file, 'utf8');
      const missing = assertedText(spec).filter((t) => !sourceCorpus.includes(t));
      expect(missing, `copy asserted by this manual spec no longer exists anywhere in the repo`).toEqual([]);
    },
  );

  it.each(manualSpecs.map((f) => [f.slice(REPO_ROOT.length + 1), f]))(
    '%s targets only selectors that still exist',
    (_label, file) => {
      const spec = readFileSync(file, 'utf8');
      const missing = assertedSelectors(spec).filter((s) => !sourceCorpus.includes(s));
      expect(missing, `element selectors targeted by this manual spec no longer exist`).toEqual([]);
    },
  );
});
