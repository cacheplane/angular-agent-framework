// SPDX-License-Identifier: MIT
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RENDER_DIR = resolve(WORKSPACE_ROOT, 'cockpit/render');
const ANGULAR_EXAMPLE_DIRS = ['cockpit', 'examples'];
const SUPPORTED_RENDER_DIRECTIVES = new Set([
  '$and',
  '$bindItem',
  '$bindState',
  '$computed',
  '$cond',
  '$else',
  '$index',
  '$item',
  '$or',
  '$state',
  '$template',
  '$then',
]);

function renderSpecFiles(): string[] {
  return readdirSync(RENDER_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => resolve(RENDER_DIR, entry.name, 'angular/src/app/specs.ts'))
    .filter((file) => existsSync(file));
}

function angularSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...angularSourceFiles(path));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.html')) {
      out.push(path);
    }
  }
  return out;
}

function collectDirectiveNames(value: unknown, out = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const item of value) collectDirectiveNames(item, out);
    return out;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (/^\$[A-Za-z][A-Za-z0-9_]*$/.test(key)) out.add(key);
    collectDirectiveNames(nested, out);
  }
  return out;
}

function parseJsonRenderSpecs(source: string): unknown[] {
  const specs: unknown[] = [];
  const pattern = /json:\s*JSON\.stringify\(([\s\S]*?),\s*null,\s*2\)/g;
  for (const match of source.matchAll(pattern)) {
    specs.push(Function(`"use strict"; return (${match[1]});`)());
  }
  return specs;
}

describe('cockpit examples latent bug sweep guards', () => {
  it('uses only render directives supported by @json-render/core', () => {
    const unsupported: string[] = [];
    for (const file of renderSpecFiles()) {
      const rel = file.slice(WORKSPACE_ROOT.length + 1);
      for (const spec of parseJsonRenderSpecs(readFileSync(file, 'utf8'))) {
        for (const directive of collectDirectiveNames(spec)) {
          if (!SUPPORTED_RENDER_DIRECTIVES.has(directive)) {
            unsupported.push(`${rel}: ${directive}`);
          }
        }
      }
    }

    expect(unsupported).toEqual([]);
  });

  it('passes CSS lengths, not Tailwind width classes, to example-chat-layout sidebarWidth', () => {
    const offenders: string[] = [];
    for (const root of ANGULAR_EXAMPLE_DIRS) {
      for (const file of angularSourceFiles(resolve(WORKSPACE_ROOT, root))) {
        const source = readFileSync(file, 'utf8');
        if (/sidebarWidth="w-\d+"/.test(source)) {
          offenders.push(file.slice(WORKSPACE_ROOT.length + 1));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
