import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getAllDocSlugs, getDocBySlug, getDocMetadata } from './docs';
import { allDocsPages } from './docs-config';
import { getCanonicalUrl, getSitemapRoutes } from './site-metadata';

const internalDocsLinkPattern = /(?:href=["']|\]\()(?<href>\/docs\/[^"')#\s]+)/g;

function findInternalDocsLinks(content: string): string[] {
  return Array.from(content.matchAll(internalDocsLinkPattern), (match) => match.groups?.href)
    .filter((href): href is string => Boolean(href));
}

const contentRoot = path.join(process.cwd(), 'apps', 'website', 'content', 'docs');

function walkMdxFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) return walkMdxFiles(fullPath);
    return entry.endsWith('.mdx') ? [fullPath] : [];
  });
}

function getConfiguredDocPath({ library, section, slug }: { library: string; section: string; slug: string }): string {
  return path.join(contentRoot, library, section, `${slug}.mdx`);
}

function findPackageImports(content: string): string[] {
  const imports = Array.from(content.matchAll(/from\s+['"](?<pkg>@ngaf\/[^'"]+)['"]/g), (match) => match.groups?.pkg);
  const dynamicImports = Array.from(content.matchAll(/import\(\s*['"](?<pkg>@ngaf\/[^'"]+)['"]\s*\)/g), (match) => match.groups?.pkg);
  return [...imports, ...dynamicImports].filter((pkg): pkg is string => Boolean(pkg));
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

  it('does not leave tracked MDX docs outside the configured docs inventory', () => {
    const configuredPaths = new Set(getAllDocSlugs().map((slug) => getConfiguredDocPath(slug)));
    const unconfigured = walkMdxFiles(contentRoot)
      .filter((filePath) => !configuredPaths.has(filePath))
      .map((filePath) => path.relative(contentRoot, filePath));

    expect(unconfigured).toEqual([]);
  });

  it('loads a doc by library, section and slug', () => {
    const doc = getDocBySlug('agent', 'getting-started', 'introduction');
    expect(doc).not.toBeNull();
    expect(doc?.title).toBe('Introduction');
  });

  it('resolves page metadata for configured docs', () => {
    const metadata = getDocMetadata('ag-ui', 'reference', 'event-mapping');

    expect(metadata).toMatchObject({
      title: 'Event Mapping - AG-UI Docs - Agent UI for Angular',
      alternates: {
        canonical: '/docs/ag-ui/reference/event-mapping',
      },
      openGraph: {
        title: 'Event Mapping - AG-UI Docs - Agent UI for Angular',
        url: '/docs/ag-ui/reference/event-mapping',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Event Mapping - AG-UI Docs - Agent UI for Angular',
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
    expect(getCanonicalUrl('/docs/agent/guides/streaming')).toBe('https://threadplane.ai/docs/agent/guides/streaming');
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

  it('uses package imports that match published package entry points', () => {
    const validPackages = new Set([
      '@ngaf/a2ui',
      '@ngaf/ag-ui',
      '@ngaf/chat',
      '@ngaf/chat/debug',
      '@ngaf/chat/testing',
      '@ngaf/langgraph',
      '@ngaf/licensing',
      '@ngaf/render',
      '@ngaf/telemetry',
      '@ngaf/telemetry/browser',
      '@ngaf/telemetry/node',
      '@ngaf/telemetry/shared',
    ]);

    const invalidImports: string[] = [];

    for (const { library, section, slug } of getAllDocSlugs()) {
      const doc = getDocBySlug(library, section, slug);
      if (!doc) continue;

      for (const pkg of findPackageImports(doc.content)) {
        if (!validPackages.has(pkg)) {
          invalidImports.push(`${library}/${section}/${slug} -> ${pkg}`);
        }
      }
    }

    expect(invalidImports).toEqual([]);
  });

  it('has generated API docs for every documented package surface', () => {
    const librariesWithApiDocs = ['agent', 'chat', 'render', 'ag-ui', 'a2ui', 'licensing', 'telemetry'];
    const missingApiDocs = librariesWithApiDocs.filter((library) => {
      const apiDocsPath = path.join(contentRoot, library, 'api', 'api-docs.json');
      if (!fs.existsSync(apiDocsPath)) return true;

      const entries = JSON.parse(fs.readFileSync(apiDocsPath, 'utf8')) as unknown[];
      return entries.length === 0;
    });

    expect(missingApiDocs).toEqual([]);
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
