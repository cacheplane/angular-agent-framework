// SPDX-License-Identifier: MIT
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEBSITE_ROOT = join(process.cwd(), 'apps/website');
const ACTIVE_SURFACES = ['.'] as const;
const EXCLUDED_DIRECTORIES = new Set([
  '.next',
  '.turbo',
  '.vercel',
  '__fixtures__',
  '__snapshots__',
  'coverage',
  'dist',
  'fixtures',
  'node_modules',
  'out',
  'playwright-report',
  'test-results',
]);
const ACTIVE_EXTENSIONS = new Set([
  '.adoc',
  '.cjs',
  '.css',
  '.cts',
  '.graphql',
  '.gql',
  '.htm',
  '.html',
  '.env',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.less',
  '.md',
  '.mdx',
  '.mjs',
  '.mts',
  '.py',
  '.rst',
  '.sass',
  '.scss',
  '.sh',
  '.svg',
  '.template',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);
const RETIRED_HOST = 'cockpit.threadplane.ai';
/**
 * Explicit exceptions must match the relative path, one-based line number,
 * and complete line text. This is intentionally empty today. If an active
 * technical occurrence becomes necessary, document it here with
 * `retiredHostOccurrenceKey(...)` rather than adding a keyword heuristic.
 */
const RETIRED_HOST_ALLOWLIST = new Set<string>();

interface ActiveTextSource {
  readonly relativePath: string;
  readonly content: string;
}

function activeTextExtension(fileName: string): string {
  if (fileName === '.env' || fileName.startsWith('.env.')) return '.env';
  return fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return EXCLUDED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
    }
    if (!entry.isFile()) return [];
    if (/\.(?:fixture|spec|test)\.[^.]+$/.test(entry.name)) return [];
    const extension = activeTextExtension(entry.name);
    return ACTIVE_EXTENSIONS.has(extension) ? [path] : [];
  });
}

function retiredHostOccurrenceKey(
  relativePath: string,
  lineNumber: number,
  line: string
): string {
  return JSON.stringify([relativePath, lineNumber, line]);
}

function findRetiredHostViolations(
  sources: readonly ActiveTextSource[],
  allowlist: ReadonlySet<string> = RETIRED_HOST_ALLOWLIST
): string[] {
  return sources.flatMap(({ relativePath, content }) =>
    content.split('\n').flatMap((line, index) => {
      const lineNumber = index + 1;
      if (!line.includes(RETIRED_HOST)) return [];
      if (
        allowlist.has(
          retiredHostOccurrenceKey(relativePath, lineNumber, line)
        )
      ) {
        return [];
      }
      return [`${relativePath}:${lineNumber}`];
    })
  );
}

describe('Cockpit surface retirement', () => {
  it('scans the whole active Website tree', () => {
    expect(ACTIVE_SURFACES).toEqual(['.']);
    const files = sourceFiles(WEBSITE_ROOT).map((path) =>
      relative(WEBSITE_ROOT, path)
    );

    expect(files).toContain('project.json');
    expect(files).toContain('vite.config.mts');
    expect(files).toContain('.env.example');
    expect(files).toContain('emails/newsletter-welcome.ts');
    expect(files).toContain('lib/resend.ts');
    expect(files).toContain('public/CLAUDE.md');
    expect(files).toContain('scripts/computed-style-snapshot.js');
    expect(files).not.toContain('next.config.spec.ts');
    expect(files).not.toContain('src/lib/cockpit-retirement.spec.ts');
    expect(files.some((path) => path.startsWith('.next/'))).toBe(false);
    expect(files.some((path) => path.startsWith('node_modules/'))).toBe(false);
    expect(files.some((path) => path.startsWith('test-results/'))).toBe(false);
    expect(files.some((path) => path.includes('/fixtures/'))).toBe(false);
  });

  it('scans active JavaScript, module, data, and authored text surfaces', () => {
    for (const extension of [
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.mts',
      '.cts',
      '.json',
      '.css',
      '.html',
      '.yaml',
    ]) {
      expect(ACTIVE_EXTENSIONS.has(extension), extension).toBe(true);
    }

    for (const fileName of [
      '.env',
      '.env.example',
      '.env.local',
      '.env.production.local',
    ]) {
      expect(
        ACTIVE_EXTENSIONS.has(activeTextExtension(fileName)),
        fileName
      ).toBe(true);
    }
    expect(ACTIVE_EXTENSIONS.has(activeTextExtension('.cache.binary'))).toBe(
      false
    );
  });

  it('keeps the retired Cockpit origin out of active Website links and authored content', () => {
    const sources = ACTIVE_SURFACES.flatMap((surface) =>
      sourceFiles(join(WEBSITE_ROOT, surface)).map((path) => ({
        relativePath: relative(WEBSITE_ROOT, path),
        content: readFileSync(path, 'utf8'),
      }))
    );

    expect(findRetiredHostViolations(sources)).toEqual([]);
  });

  it('does not exempt a retired-host occurrence merely because the line says CORS', () => {
    const line =
      '// CORS documentation must not mention https://cockpit.threadplane.ai';
    expect(
      findRetiredHostViolations([
        { relativePath: 'next.config.mjs', content: line },
      ])
    ).toEqual(['next.config.mjs:1']);
  });

  it('only exempts an explicitly allowlisted exact occurrence', () => {
    const relativePath = 'next.config.mjs';
    const line = "const allowedOrigin = 'https://cockpit.threadplane.ai';";
    const allowlist = new Set([
      retiredHostOccurrenceKey(relativePath, 1, line),
    ]);

    expect(
      findRetiredHostViolations(
        [{ relativePath, content: line }],
        allowlist
      )
    ).toEqual([]);
    expect(
      findRetiredHostViolations(
        [{ relativePath, content: `${line} // CORS` }],
        allowlist
      )
    ).toEqual(['next.config.mjs:1']);
  });

  it('describes the AG-UI screenshot as the docs workspace rather than Cockpit', () => {
    const post = readFileSync(
      join(
        WEBSITE_ROOT,
        'content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx'
      ),
      'utf8'
    );

    expect(post).not.toContain('alt="The cockpit ag-ui/interrupts welcome screen');
    expect(post).toContain('alt="The Threadplane docs workspace');
  });
});
