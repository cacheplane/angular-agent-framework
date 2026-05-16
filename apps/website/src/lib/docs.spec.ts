import { describe, expect, it } from 'vitest';
import { getAllDocSlugs, getDocBySlug, getDocMetadata } from './docs';
import { allDocsPages } from './docs-config';
import { getCanonicalUrl, getSitemapRoutes } from './site-metadata';

const internalDocsLinkPattern = /(?:href=["']|\]\()(?<href>\/docs\/[^"')#\s]+)/g;

function findInternalDocsLinks(content: string): string[] {
  return Array.from(content.matchAll(internalDocsLinkPattern), (match) => match.groups?.href)
    .filter((href): href is string => Boolean(href));
}

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
    const metadata = getDocMetadata('ag-ui', 'reference', 'event-mapping');

    expect(metadata).toMatchObject({
      title: 'Event Mapping - AG-UI Docs - Angular Agent Framework',
      alternates: {
        canonical: '/docs/ag-ui/reference/event-mapping',
      },
      openGraph: {
        title: 'Event Mapping - AG-UI Docs - Angular Agent Framework',
        url: '/docs/ag-ui/reference/event-mapping',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Event Mapping - AG-UI Docs - Angular Agent Framework',
      },
    });
    expect(metadata?.description).toContain('AG-UI protocol events');
    expect(metadata?.description).not.toBe(
      'Adapter for any AG-UI-compatible backend (CrewAI, Mastra, Microsoft AF, AG2, Pydantic AI, AWS Strands, CopilotKit runtime)',
    );
  });

  it('derives mostly unique descriptions from page content', () => {
    const descriptions = getAllDocSlugs()
      .map(({ library, section, slug }) => getDocMetadata(library, section, slug)?.description)
      .filter((description): description is string => Boolean(description));

    const duplicateDescriptions = descriptions.filter((description, index) => descriptions.indexOf(description) !== index);
    expect(duplicateDescriptions).toHaveLength(0);
  });

  it('includes every configured doc page in the sitemap routes', () => {
    const sitemapRoutes = getSitemapRoutes();

    for (const { library, section, slug } of getAllDocSlugs()) {
      expect(sitemapRoutes).toContain(`/docs/${library}/${section}/${slug}`);
    }
  });

  it('resolves canonical URLs against the production origin', () => {
    expect(getCanonicalUrl('/docs/agent/guides/streaming')).toBe('https://cacheplane.ai/docs/agent/guides/streaming');
  });

  it('does not contain stale or broken internal docs links', () => {
    const validDocsRoutes = new Set(['/docs', ...getSitemapRoutes().filter((route) => route.startsWith('/docs/'))]);
    const brokenLinks: string[] = [];

    for (const { library, section, slug } of getAllDocSlugs()) {
      const doc = getDocBySlug(library, section, slug);
      if (!doc) continue;

      for (const href of findInternalDocsLinks(doc.content)) {
        if (!validDocsRoutes.has(href)) {
          brokenLinks.push(`${library}/${section}/${slug} -> ${href}`);
        }
      }
    }

    expect(brokenLinks).toEqual([]);
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
