// SPDX-License-Identifier: MIT
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const WEBSITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT_ROOT = join(WEBSITE_ROOT, 'content');

/**
 * Claims this site does not make.
 *
 * Each of these asserts something absolute about behavior that no test keeps
 * true. A published guarantee that quietly stops holding is worse than no
 * guarantee, so `/privacy` describes categories and purposes instead and these
 * phrasings are barred from every public surface.
 */
const BANNED_CLAIMS: ReadonlyArray<readonly [string, RegExp]> = [
  ['phone-home claim', /phon(?:e|ing) home/iu],
  ['installation inertness claim', /installation is inert/iu],
  ['off-by-default claim', /off by default/iu],
  ['what-we-wont-do positioning', /what we (?:won'|won’|will not )t? ?do/iu],
  ['nothing-emitted guarantee', /no telemetry is emitted/iu],
  ['never-collected list', /we (?:never|do not) collect/iu],
];

/**
 * Narrative uses of the word, as opposed to the identifier.
 *
 * `telemetry` is the real name of a public config field, so the word cannot be
 * banned outright without making the API tables wrong. What is barred is prose
 * that markets it — the surrounding sentences, not the field.
 */
const NARRATIVE_MENTIONS: ReadonlyArray<readonly [string, RegExp]> = [
  ['opt-in telemetry positioning', /telemetry is opt-in/iu],
  ['browser-telemetry positioning', /browser telemetry/iu],
  ['debugging-and-telemetry aside', /for debugging and telemetry/iu],
  ['we-have-telemetry framing', /we have telemetry/iu],
  ['telemetry hooks aside', /telemetry hooks/iu],
];

function publicContentFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...publicContentFiles(path));
      // Only hand-authored content. Generated API JSON is projected rather than
      // written, and cleaning it is the projection's job, not an author's.
    } else if (/\.mdx$/u.test(entry.name)) {
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
        if (/\/docs\/telemetry|\/api\/markdown\/telemetry/u.test(line)) {
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
