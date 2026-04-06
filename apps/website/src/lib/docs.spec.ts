import { describe, expect, it } from 'vitest';
import { getAllDocSlugs, getDocBySlug } from './docs-new';
import { allDocsPages } from './docs-config';

describe('website docs bindings', () => {
  it('lists all doc slugs from config', () => {
    const slugs = getAllDocSlugs();
    expect(slugs.length).toBe(allDocsPages.length);
    expect(slugs).toContainEqual({ section: 'getting-started', slug: 'introduction' });
    expect(slugs).toContainEqual({ section: 'guides', slug: 'streaming' });
    expect(slugs).toContainEqual({ section: 'api', slug: 'stream-resource' });
  });

  it('loads a doc by section and slug', () => {
    const doc = getDocBySlug('getting-started', 'introduction');
    expect(doc).not.toBeNull();
    expect(doc?.title).toBe('Introduction');
    expect(doc?.content).toContain('Angular Stream Resource');
  });

  it('returns null for non-existent doc', () => {
    expect(getDocBySlug('guides', 'nonexistent')).toBeNull();
  });
});
