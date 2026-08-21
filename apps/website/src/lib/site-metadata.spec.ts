import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_META_DESCRIPTION,
  HERO_SUBHEAD,
  LONG_SUBHEAD,
  POSITIONING_PROOF_POINTS,
  PRIMARY_TAGLINE,
  SHORT_POSITIONING_DESCRIPTION,
  SITE_NAME,
  createPageMetadata,
} from './site-metadata';
import { resolveWebsiteDir } from './website-dir';

describe('site positioning copy', () => {
  it('exports the approved primary tagline and supporting copy', () => {
    expect(PRIMARY_TAGLINE).toBe('Threadplane. Durable threads, interrupts, subagents, planning, memory, and generative UI.');
    expect(LONG_SUBHEAD).toContain('fullstack agentic Angular framework');
    expect(LONG_SUBHEAD).toContain('LangGraph and AG-UI-compatible agents');
    expect(LONG_SUBHEAD).toContain('Vercel json-render and Google A2UI');
    expect(HERO_SUBHEAD).toContain('durable threads, interrupts, subagents, planning, memory, and generative UI');
    expect(POSITIONING_PROOF_POINTS.map((p) => p.label)).toEqual([
      'LangGraph + AG-UI',
      'Durable threads',
      'Interrupts',
      'Subagents',
      'Planning + memory',
      'json-render + A2UI',
    ]);
    expect(POSITIONING_PROOF_POINTS.map((p) => p.href)).toEqual([
      '/docs/choosing-an-adapter',
      '/docs/langgraph/guides/persistence',
      '/docs/langgraph/guides/interrupts',
      '/docs/langgraph/guides/subgraphs',
      '/docs/langgraph/guides/memory',
      '/docs/render/concepts/json-render-vs-a2ui',
    ]);
    expect(DEFAULT_META_DESCRIPTION).toBe(SHORT_POSITIONING_DESCRIPTION);
  });

  it('uses canonical copy in generated page metadata', () => {
    const metadata = createPageMetadata({
      title: PRIMARY_TAGLINE,
      description: DEFAULT_META_DESCRIPTION,
      pathname: '/',
      type: 'website',
    });

    expect(metadata.title).toBe(PRIMARY_TAGLINE);
    expect(metadata.description).toBe(DEFAULT_META_DESCRIPTION);
    expect(metadata.openGraph?.description).toBe(DEFAULT_META_DESCRIPTION);
    expect(metadata.twitter?.description).toBe(DEFAULT_META_DESCRIPTION);
  });
});

describe('createPageMetadata article fields', () => {
  it('emits openGraph article dates, authors, and tags', () => {
    const metadata = createPageMetadata({
      title: 'Post — Threadplane',
      description: 'A post.',
      pathname: '/blog/post',
      type: 'article',
      article: {
        publishedTime: '2026-08-13',
        modifiedTime: '2026-08-14',
        authors: ['Brian Love'],
        tags: ['angular', 'ag-ui'],
      },
    });
    const openGraph = metadata.openGraph as Record<string, unknown>;
    expect(openGraph['publishedTime']).toBe('2026-08-13');
    expect(openGraph['modifiedTime']).toBe('2026-08-14');
    expect(openGraph['authors']).toEqual(['Brian Love']);
    expect(openGraph['tags']).toEqual(['angular', 'ag-ui']);
  });

  it('accepts a page-specific social image', () => {
    const metadata = createPageMetadata({
      title: 'Post — Threadplane',
      description: 'A post.',
      pathname: '/blog/post',
      image: '/blog/post/opengraph-image',
    });
    const openGraph = metadata.openGraph as { images: string[] };
    expect(openGraph.images).toEqual(['/blog/post/opengraph-image']);
  });
});

describe('createPageMetadata article fallback', () => {
  it('advertises the publish date as the modification when none is known', () => {
    const metadata = createPageMetadata({
      title: 'Post — Threadplane',
      description: 'A post.',
      pathname: '/blog/post',
      article: { publishedTime: '2026-08-13T00:00:00.000Z' },
    });
    const openGraph = metadata.openGraph as Record<string, unknown>;
    expect(openGraph['modifiedTime']).toBe('2026-08-13T00:00:00.000Z');
  });

  it('omits article fields entirely for a non-article page', () => {
    const metadata = createPageMetadata({
      title: 'Home — Threadplane',
      description: 'A page.',
      pathname: '/',
      type: 'website',
    });
    const openGraph = metadata.openGraph as Record<string, unknown>;
    // Absent, not undefined: Next emits a meta tag for a present-but-undefined
    // key in some shapes, and a landing page has no publication to date.
    expect('publishedTime' in openGraph).toBe(false);
    expect('modifiedTime' in openGraph).toBe(false);
    expect('authors' in openGraph).toBe(false);
    expect('tags' in openGraph).toBe(false);
  });
});

describe('brand name', () => {
  // Built at runtime so this spec file — which lives under a scanned root —
  // does not match its own needle.
  const MISSPELLING = new RegExp(['Thread', 'Plane'].join(''), 'g');
  const SCAN_ROOTS = ['src', 'content', 'scripts', 'e2e'];
  const ALLOWED = new Set([
    // A deliberate mixed-case URL fixture for host-case normalization.
    path.join('scripts', 'gsc', 'analysis.spec.ts'),
  ]);
  const SKIP_DIRS = new Set(['node_modules', '.next', 'dist']);

  function walk(dir: string, root: string, out: string[]): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full, root, out);
      } else if (entry.isFile()) {
        out.push(path.relative(root, full));
      }
    }
    return out;
  }

  it('is spelled the same way everywhere it ships', () => {
    const websiteDir = resolveWebsiteDir();
    const offenders: string[] = [];

    for (const root of SCAN_ROOTS) {
      const rootDir = path.join(websiteDir, root);
      if (!fs.existsSync(rootDir)) continue;
      for (const relative of walk(rootDir, websiteDir, [])) {
        if (ALLOWED.has(relative)) continue;
        if (MISSPELLING.test(fs.readFileSync(path.join(websiteDir, relative), 'utf8'))) {
          offenders.push(relative);
        }
        MISSPELLING.lastIndex = 0;
      }
    }

    expect(offenders).toEqual([]);
    expect(SITE_NAME).toBe('Threadplane');
  });
});
