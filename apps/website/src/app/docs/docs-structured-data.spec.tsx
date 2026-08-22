import { describe, expect, it } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import DocsPage, { generateMetadata } from './[library]/[section]/[slug]/page';
import { DocsBreadcrumb } from '../../components/docs/DocsBreadcrumb';
import { docsConfig, type LibraryId } from '../../lib/docs-config';
import { getDocBySlug } from '../../lib/docs';
import { getSitemapRoutes } from '../../lib/site-metadata';

interface Slug {
  library: string;
  section: string;
  slug: string;
}

/**
 * A spread of shapes rather than every page: one per description source
 * (frontmatter, first-paragraph fallback), an API page, and a page that is
 * itself the library's breadcrumb target.
 */
const SAMPLES: Slug[] = [
  { library: 'langgraph', section: 'guides', slug: 'streaming' },
  { library: 'langgraph', section: 'getting-started', slug: 'introduction' },
  { library: 'langgraph', section: 'api', slug: 'inject-agent' },
  { library: 'chat', section: 'getting-started', slug: 'introduction' },
  { library: 'a2ui', section: 'getting-started', slug: 'introduction' },
];

/** Every `data` payload the page hands to a `<JsonLd>`, in render order. */
async function renderedJsonLd({ library, section, slug }: Slug): Promise<Record<string, unknown>[]> {
  const tree = await DocsPage({ params: Promise.resolve({ library, section, slug }) });
  const found: Record<string, unknown>[] = [];

  const walk = (node: ReactNode): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!isValidElement(node)) return;
    const props = node.props as { data?: Record<string, unknown>; children?: ReactNode };
    // Matched by name because `JsonLd` is a plain function component; importing
    // it for identity would still work, but the name keeps the failure legible.
    if (typeof node.type === 'function' && (node.type as { name?: string }).name === 'JsonLd' && props.data) {
      found.push(props.data);
    }
    walk(props.children);
  };

  walk(tree);
  return found;
}

function nodeOfType(nodes: Record<string, unknown>[], type: string): Record<string, unknown> | undefined {
  return nodes.find((node) => node['@type'] === type);
}

describe('docs page structured data', () => {
  // The tautology this replaces compared `resolveDocDescription` against
  // `getDocMetadata`, which calls it — both sides were the same function. The
  // real risk is the *page* describing itself differently from its own
  // `generateMetadata`, so the assertion runs over both actual surfaces.
  it('describes itself with the same string its metadata publishes', async () => {
    for (const sample of SAMPLES) {
      const [article, metadata] = await Promise.all([
        renderedJsonLd(sample).then((nodes) => nodeOfType(nodes, 'TechArticle')),
        generateMetadata({ params: Promise.resolve(sample) }),
      ]);

      const label = `${sample.library}/${sample.section}/${sample.slug}`;
      expect([label, typeof metadata.description]).toEqual([label, 'string']);
      expect([label, article?.description]).toEqual([label, metadata.description]);
    }
  });

  it('emits exactly a TechArticle and a BreadcrumbList', async () => {
    const nodes = await renderedJsonLd(SAMPLES[0]);
    expect(nodes.map((node) => node['@type'])).toEqual(['TechArticle', 'BreadcrumbList']);
  });

  // Google expects the breadcrumb markup to correspond to the visible trail, so
  // the JSON-LD is checked against what <DocsBreadcrumb> actually renders rather
  // than against a second copy of the same string.
  it('links the same library URL the visible breadcrumb links', async () => {
    for (const sample of SAMPLES) {
      const doc = getDocBySlug(sample.library, sample.section, sample.slug);
      const nodes = await renderedJsonLd(sample);
      const crumbs = nodeOfType(nodes, 'BreadcrumbList')?.itemListElement as
        | { name: string; item: string }[]
        | undefined;

      const { unmount } = render(
        <DocsBreadcrumb
          library={sample.library as LibraryId}
          section={sample.section}
          slug={sample.slug}
          title={doc?.title ?? ''}
        />,
      );
      const libraryTitle = docsConfig.find((lib) => lib.id === sample.library)?.title ?? '';
      const visibleHref = screen.getByRole('link', { name: libraryTitle }).getAttribute('href');
      unmount();

      const label = `${sample.library}/${sample.section}/${sample.slug}`;
      expect([label, crumbs?.find((crumb) => crumb.name === libraryTitle)?.item]).toEqual([
        label,
        `https://threadplane.ai${visibleHref}`,
      ]);
    }
  });

  // A non-final BreadcrumbList item pointing at a 404 is a defect, and the
  // plan's original `/docs/<library>` was exactly that. Rendering the page is
  // what gives this teeth: reverting the URL in page.tsx fails here.
  it('points every non-final breadcrumb rung at a route that exists', async () => {
    const routes = new Set(getSitemapRoutes().map((route) => `https://threadplane.ai${route === '/' ? '/' : route}`));

    for (const sample of SAMPLES) {
      const nodes = await renderedJsonLd(sample);
      const crumbs = nodeOfType(nodes, 'BreadcrumbList')?.itemListElement as { item: string }[];
      const missing = crumbs.slice(0, -1).map((crumb) => crumb.item).filter((item) => !routes.has(item));
      expect([`${sample.library}/${sample.section}/${sample.slug}`, missing]).toEqual([
        `${sample.library}/${sample.section}/${sample.slug}`,
        [],
      ]);
    }
  });
});
