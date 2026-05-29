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
      '/docs/langgraph/concepts/langgraph-basics',
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
