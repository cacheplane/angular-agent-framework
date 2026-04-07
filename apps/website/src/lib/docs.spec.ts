import { describe, expect, it } from 'vitest';
import { getAllDocSlugs, getDocBySlug } from './docs';
import { allDocsPages } from './docs-config';

describe('website docs bindings', () => {
  it('lists all doc slugs from config', () => {
    const slugs = getAllDocSlugs();
    expect(slugs.length).toBe(allDocsPages.length);
    expect(slugs).toContainEqual({ library: 'agent', section: 'getting-started', slug: 'introduction' });
    expect(slugs).toContainEqual({ library: 'agent', section: 'guides', slug: 'streaming' });
    expect(slugs).toContainEqual({ library: 'render', section: 'getting-started', slug: 'introduction' });
    expect(slugs).toContainEqual({ library: 'chat', section: 'getting-started', slug: 'introduction' });
  });

  it('loads a doc by library, section and slug', () => {
    const doc = getDocBySlug('agent', 'getting-started', 'introduction');
    expect(doc).not.toBeNull();
    expect(doc?.title).toBe('Introduction');
  });

  it('returns null for non-existent doc', () => {
    expect(getDocBySlug('agent', 'guides', 'nonexistent')).toBeNull();
  });

  it('returns null for non-existent library', () => {
    expect(getDocBySlug('nonexistent', 'getting-started', 'introduction')).toBeNull();
  });
});
