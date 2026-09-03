// SPDX-License-Identifier: MIT
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BANNED_CLAIMS,
  NARRATIVE_MENTIONS,
  RETIRED_ROUTE_PATTERN,
  findBarredCopy,
} from './public-copy-contract';

const WEBSITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT_ROOT = join(WEBSITE_ROOT, 'content');

function publicContentFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...publicContentFiles(path));
    } else if (/\.(?:mdx|json)$/u.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

function offenders(
  patterns: ReadonlyArray<readonly [string, RegExp]>
): string[] {
  const hits: string[] = [];
  for (const path of publicContentFiles(CONTENT_ROOT)) {
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const [label, pattern] of patterns) {
        if (pattern.test(line)) {
          hits.push(`${relative(WEBSITE_ROOT, path)}:${index + 1} — ${label}`);
        }
      }
    });
  }
  return hits;
}

describe('public copy', () => {
  it('makes none of the barred absolute claims', () => {
    expect(offenders(BANNED_CLAIMS)).toEqual([]);
  });

  it('carries no narrative telemetry positioning', () => {
    expect(offenders(NARRATIVE_MENTIONS)).toEqual([]);
  });

  it('links no retired documentation route', () => {
    const hits: string[] = [];
    for (const path of publicContentFiles(CONTENT_ROOT)) {
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (RETIRED_ROUTE_PATTERN.test(line)) {
          hits.push(`${relative(WEBSITE_ROOT, path)}:${index + 1}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  /**
   * The counterpart to the bans: the field is real, so it stays documented.
   * Without this, a future cleanup could satisfy the rules above by deleting
   * the API rows and leaving developers with an undocumented option.
   */
  it('still documents the telemetry config field on every adapter', () => {
    const documented = [
      'docs/ag-ui/api/provide-agent.mdx',
      'docs/ag-ui/api/to-agent.mdx',
      'docs/langgraph/api/provide-agent.mdx',
    ];
    for (const relativePath of documented) {
      const source = readFileSync(join(CONTENT_ROOT, relativePath), 'utf8');
      expect(source, `${relativePath} must document the field`).toMatch(
        /\|\s*`telemetry`\s*\|/u
      );
    }
  });
});

/**
 * Generated API JSON is projected rather than authored, so the guard belongs
 * with the generator. This asserts the projection is actually wired in: the
 * committed output is public, and it is the thing readers see.
 */
describe('generated public API docs', () => {
  const libraries = [
    'a2ui',
    'ag-ui',
    'chat',
    'langgraph',
    'middleware',
    'render',
  ];

  it.each(libraries)('%s carries no barred claim', (library) => {
    const source = readFileSync(
      join(CONTENT_ROOT, 'docs', library, 'api', 'api-docs.json'),
      'utf8'
    );
    expect(findBarredCopy(source, BANNED_CLAIMS)).toEqual([]);
  });

  it('no longer ships the retired library', () => {
    expect(
      publicContentFiles(CONTENT_ROOT).filter((path) =>
        path.includes(`${join('docs', 'telemetry')}`)
      )
    ).toEqual([]);
  });
});
