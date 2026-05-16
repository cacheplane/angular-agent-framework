import { describe, expect, it } from 'vitest';
import { getAllDocSlugs, getDocBySlug, getDocMetadata } from './docs';
import { allDocsPages } from './docs-config';

describe('website docs bindings', () => {
  it('lists all doc slugs from config', () => {
    const slugs = getAllDocSlugs();
    expect(slugs.length).toBe(allDocsPages.length);
    expect(slugs).toContainEqual({ library: 'agent', section: 'getting-started', slug: 'introduction' });
    expect(slugs).toContainEqual({ library: 'agent', section: 'guides', slug: 'streaming' });
    expect(slugs).toContainEqual({ library: 'render', section: 'getting-started', slug: 'introduction' });
    expect(slugs).toContainEqual({ library: 'chat', section: 'getting-started', slug: 'introduction' });
    expect(slugs).toContainEqual({ library: 'ag-ui', section: 'concepts', slug: 'architecture' });
    expect(slugs).toContainEqual({ library: 'a2ui', section: 'getting-started', slug: 'introduction' });
    expect(slugs).toContainEqual({ library: 'licensing', section: 'guides', slug: 'setup' });
    expect(slugs).toContainEqual({ library: 'telemetry', section: 'guides', slug: 'privacy-and-opt-out' });
  });

  it('loads every configured doc page', () => {
    for (const { library, section, slug } of getAllDocSlugs()) {
      expect(getDocBySlug(library, section, slug)).not.toBeNull();
    }
  });

  it('loads a doc by library, section and slug', () => {
    const doc = getDocBySlug('agent', 'getting-started', 'introduction');
    expect(doc).not.toBeNull();
    expect(doc?.title).toBe('Introduction');
  });

  it('resolves page metadata for configured docs', () => {
    expect(getDocMetadata('ag-ui', 'reference', 'event-mapping')).toEqual({
      title: 'Event Mapping - AG-UI Docs - Angular Agent Framework',
      description:
        'Adapter for any AG-UI-compatible backend (CrewAI, Mastra, Microsoft AF, AG2, Pydantic AI, AWS Strands, CopilotKit runtime)',
    });
  });

  it('returns null for non-existent doc', () => {
    expect(getDocBySlug('agent', 'guides', 'nonexistent')).toBeNull();
  });

  it('returns null for non-existent library', () => {
    expect(getDocBySlug('nonexistent', 'getting-started', 'introduction')).toBeNull();
  });

  it('returns null metadata for non-existent docs', () => {
    expect(getDocMetadata('agent', 'guides', 'nonexistent')).toBeNull();
  });
});
