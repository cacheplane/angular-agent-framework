import { describe, expect, it } from 'vitest';
import {
  DEFAULT_META_DESCRIPTION,
  HERO_SUBHEAD,
  LONG_SUBHEAD,
  POSITIONING_PROOF_POINTS,
  PRIMARY_TAGLINE,
  SHORT_POSITIONING_DESCRIPTION,
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

describe('getSitemapEntries', () => {
  it('emits a valid lastModified date for every route', async () => {
    const { getSitemapEntries } = await import('./site-metadata');
    const entries = getSitemapEntries();
    expect(entries.length).toBeGreaterThan(100);
    const unresolved = entries.filter(
      (e) => !(e.lastModified instanceof Date) || Number.isNaN(e.lastModified.getTime()),
    );
    expect(unresolved.map((e) => e.route)).toEqual([]);
  });

  it('uses the post date as lastModified for blog routes', async () => {
    const { getSitemapEntries } = await import('./site-metadata');
    const entry = getSitemapEntries().find((e) => e.route === '/blog/angular-chat-app-tutorial-with-ag-ui');
    expect(entry?.lastModified?.toISOString().slice(0, 10)).toBe('2026-08-13');
  });

  it('derives distinct, non-"now" dates rather than stamping the whole site with build time', async () => {
    const { getSitemapEntries } = await import('./site-metadata');
    const entries = getSitemapEntries();
    const distinct = new Set(entries.map((e) => e.lastModified?.toISOString().slice(0, 10)));
    expect(distinct.size).toBeGreaterThan(5);

    const docsEntry = entries.find((e) => e.route === '/docs/langgraph/getting-started/introduction');
    expect(docsEntry?.lastModified).toBeInstanceOf(Date);
    expect(docsEntry?.lastModified?.getTime()).toBeLessThan(Date.now());
  });

  it('resolves the special docs pages whose route shape differs from library docs', async () => {
    const { getSitemapEntries } = await import('./site-metadata');
    const entry = getSitemapEntries().find((e) => e.route === '/docs/choosing-an-adapter');
    expect(entry?.lastModified).toBeInstanceOf(Date);
  });
});
