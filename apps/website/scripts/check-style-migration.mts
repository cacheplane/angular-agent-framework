#!/usr/bin/env tsx
/**
 * Advisory value-equality check for the inline-style migration.
 *
 * Diffs the working tree (or HEAD) against a base ref, extracts
 * `property: value` pairs REMOVED from .tsx style objects and pairs ADDED to
 * the migration CSS files, normalises both sides (camelCase→kebab, React
 * numeric px, tokens.* → resolved value, var(--x) → resolved value), and
 * reports removals with no matching addition.
 *
 * KNOWN BLIND SPOTS (by design — this is a text tool, not a harness):
 *   - cascade/specificity: a correct value can still lose to another rule;
 *   - shorthand vs longhand (`padding: '0 16px'` vs padding-top…);
 *   - selectors: it compares property/value multisets, not which element
 *     they apply to.
 * Treat every flagged line as a question to answer in the PR body, not
 * necessarily a bug.
 *
 * Usage: npx tsx apps/website/scripts/check-style-migration.mts [baseRef=origin/main] [--strict]
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// NOTE: libs/design-tokens has no `"type": "module"` in its package.json, so
// Node's ESM loader resolves this .ts file as CommonJS. A static named
// import (`import { tokens } from ...`) then depends on cjs-module-lexer
// statically detecting the export from tsx's on-the-fly transform, which it
// does not for this file — it only ever finds the synthetic `default`
// (whole-module) binding. Importing the namespace and reading `.default`
// sidesteps that without touching the shared library's module format.
import * as designTokens from '../../../libs/design-tokens/src/index.ts';
const { tokens } = (designTokens as unknown as { default: typeof designTokens }).default
  ?? designTokens;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const BASE = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : 'origin/main';

// --- resolve var(--x) via the committed theme.css + website-local :root vars
const themeCss = readFileSync(
  resolve(REPO, 'libs/design-tokens/src/lib/theme.css'), 'utf8');
const globalCss = readFileSync(
  resolve(REPO, 'apps/website/src/app/global.css'), 'utf8');
const cssVars = new Map<string, string>();
for (const m of (themeCss + globalCss).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g))
  cssVars.set(m[1], m[2].trim());

// --- resolve tokens.a.b.c to its value
function tokenValue(path: string): string | undefined {
  let cur: unknown = tokens;
  for (const k of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur == null || typeof cur === 'object' ? undefined : String(cur);
}

const UNITLESS = new Set(['line-height','font-weight','opacity','z-index',
  'flex','flex-grow','flex-shrink','order']);

function normProp(p: string): string {
  return p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}
function normValue(prop: string, raw: string): string {
  let v = raw.trim();
  // Strip quotes only when one pair wraps the WHOLE value; stripping a lone
  // leading quote mangled internally-quoted font stacks ('"X", monospace').
  const q = v[0];
  if ((q === '"' || q === "'" || q === '`') && v.endsWith(q)) v = v.slice(1, -1);
  const tok = v.match(/^tokens\.([a-zA-Z0-9.]+)$/);
  if (tok) v = tokenValue(tok[1]) ?? v;
  v = v.replace(/var\((--[a-z0-9-]+)\)/g, (_, name) => cssVars.get(name) ?? _);
  if (/^-?\d+(\.\d+)?$/.test(v) && !UNITLESS.has(prop)) v = `${v}px`;
  return v.replace(/\s+/g, ' ').toLowerCase();
}

function diffLines(pathspec: string, sign: '+' | '-'): string[] {
  const out = execSync(
    `git diff -U0 ${BASE} -- ${pathspec}`, { cwd: REPO, encoding: 'utf8' });
  return out.split('\n')
    .filter((l) => l.startsWith(sign) && !l.startsWith(sign.repeat(3)))
    .map((l) => l.slice(1));
}

// pairs removed from TSX (style-object members: `foo: bar,`)
const removed = new Map<string, number>();
for (const line of diffLines("'apps/website/src/**/*.tsx'", '-')) {
  const m = line.match(/^\s*([a-zA-Z]+):\s*(.+?),?\s*$/);
  if (!m) continue;
  const prop = normProp(m[1]);
  if (!/^[a-z-]+$/.test(prop)) continue;
  const key = `${prop} :: ${normValue(prop, m[2])}`;
  removed.set(key, (removed.get(key) ?? 0) + 1);
}
// pairs added to migration CSS
const added = new Map<string, number>();
for (const line of diffLines(
  "'apps/website/src/styles/*.css' 'apps/website/src/app/global.css'", '+')) {
  for (const m of line.matchAll(/([a-z-]+):\s*([^;{}]+);/g)) {
    const key = `${m[1]} :: ${normValue(m[1], m[2])}`;
    added.set(key, (added.get(key) ?? 0) + 1);
  }
}

let flagged = 0;
for (const [key, n] of [...removed.entries()].sort()) {
  if (!added.has(key)) {
    console.log(`REMOVED, NO MATCHING CSS  (${n}x)  ${key}`);
    flagged++;
  }
}
console.log(`\n${removed.size} distinct pairs removed, ${added.size} added, ${flagged} unaccounted.`);
if (flagged > 0 && process.argv.includes('--strict')) process.exit(1);
