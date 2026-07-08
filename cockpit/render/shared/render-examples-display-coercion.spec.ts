// SPDX-License-Identifier: MIT
//
// Fitness guard for the value-coercion bug class (PR #771 numeric $state
// bindings dropped, PR #773 "[object Object]" flash for unresolved bindings).
//
// The demo view components in every render/* example bind element props
// (`content`, `value`) that resolve — via $state/$computed — to non-string values
// (numbers, or, mid-stream, unresolved objects). Displaying those raw either
// dropped the value (string-only coercion) or rendered "[object Object]".
// The fix routes them through the shared `toDisplayText` helper.
//
// This test statically asserts that invariant across ALL render example demo
// components so a new or edited example can't silently reintroduce the bug —
// it runs in the plain node vitest env (no Angular/browser needed), unlike the
// render examples themselves which have no e2e coverage (aimock N/A: no LLM).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RENDER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function exampleComponentFiles(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(RENDER_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'shared') continue;
    const appDir = resolve(RENDER_DIR, entry.name, 'angular/src/app');
    if (!existsSync(appDir)) continue;
    for (const f of readdirSync(appDir)) {
      if (f.endsWith('.component.ts')) files.push(resolve(appDir, f));
    }
  }
  return files;
}

describe('render example demo components route displayed props through toDisplayText', () => {
  const files = exampleComponentFiles();

  it('discovers the render example component files', () => {
    // Guards the guard: if the glob breaks, the assertions below vacuously pass.
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  for (const file of files) {
    const rel = file.slice(file.indexOf('cockpit/'));
    const src = readFileSync(file, 'utf8');

    it(`${rel}: never raw-interpolates content()/value() in a template`, () => {
      // Anti-pattern: `{{ content() }}` / `{{ value() }}` — must go through a
      // display*() computed backed by toDisplayText. `{{ displayContent() }}`
      // does NOT match (capital C after "display").
      const raw = src.match(/\{\{\s*(?:content|value)\(\)\s*\}\}/g);
      expect(raw, `raw prop interpolation found: ${raw?.join(', ')}`).toBeNull();
    });

    it(`${rel}: imports toDisplayText (used for content/value coercion)`, () => {
      expect(src).toContain('toDisplayText');
    });
  }
});
