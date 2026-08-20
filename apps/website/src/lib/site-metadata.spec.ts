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

describe('brand name', () => {
  it('uses one canonical spelling', () => {
    expect(SITE_NAME).toBe('Threadplane');
  });
});
