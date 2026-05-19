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
    expect(PRIMARY_TAGLINE).toBe('Agent UI for Angular — Production-ready chat, threads, and generative UI for AI agents.');
    expect(LONG_SUBHEAD).toContain('enterprise-grade Angular UI framework');
    expect(LONG_SUBHEAD).toContain('LangGraph and AG-UI-compatible agents');
    expect(LONG_SUBHEAD).toContain('json-render and A2UI-compatible specs');
    expect(HERO_SUBHEAD).toContain('headless chat, durable threads, interrupts, subagents, planning, memory');
    expect(POSITIONING_PROOF_POINTS).toEqual([
      'LangGraph + AG-UI',
      'Durable threads',
      'Interrupts',
      'Subagents',
      'Planning + memory',
      'json-render + A2UI',
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
