import type { Metadata } from 'next';
import { getAllSolutionSlugs } from './solutions-data';
import { docsConfig, specialDocsPages } from './docs-config';
import { getAllPosts } from './blog';
import { SITE_ORIGIN } from './site-origin';

export { SITE_ORIGIN };
export const SITE_NAME = 'Threadplane';
export const DEFAULT_SOCIAL_IMAGE = '/opengraph-image';
export {
  DEFAULT_META_DESCRIPTION,
  HERO_SUBHEAD,
  LONG_SUBHEAD,
  POSITIONING_PROOF_POINTS,
  PRIMARY_TAGLINE,
  SHORT_POSITIONING_DESCRIPTION,
} from './positioning';

export function getCanonicalPath(pathname: string): string {
  if (pathname === '/') return '/';
  return `/${pathname.replace(/^\/+|\/+$/g, '')}`;
}

export function getCanonicalUrl(pathname: string): string {
  return new URL(getCanonicalPath(pathname), SITE_ORIGIN).toString();
}

/** Article-specific OpenGraph fields (freshness + attribution signals). */
export interface ArticleMetadata {
  /** ISO 8601 publish date or timestamp. */
  publishedTime: string;
  /**
   * ISO 8601 last-modified timestamp. Omit when no modification is known; it
   * then falls back to `publishedTime`.
   */
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
}

/** Options for {@link createPageMetadata}. */
export interface PageMetadataOptions {
  title: string;
  description: string;
  pathname: string;
  type?: 'article' | 'website';
  /** Social image path; resolved against `metadataBase` from the root layout. */
  image?: string;
  /** Present only for article-type pages; omitted entirely for landing pages. */
  article?: ArticleMetadata;
}

export function createPageMetadata({
  title,
  description,
  pathname,
  type = 'article',
  image = DEFAULT_SOCIAL_IMAGE,
  article,
}: PageMetadataOptions): Metadata {
  const canonicalPath = getCanonicalPath(pathname);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: SITE_NAME,
      type,
      images: [image],
      ...(article && {
        publishedTime: article.publishedTime,
        // The single place the "unmodified" rule lives: an article with no
        // known modification advertises its publish date as the modification.
        modifiedTime: article.modifiedTime ?? article.publishedTime,
        authors: article.authors,
        tags: article.tags,
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export function getSitemapRoutes(): string[] {
  const staticRoutes = ['/', '/langgraph', '/render', '/chat', '/ag-ui', '/pricing', '/solutions', '/pilot-to-prod', '/docs', '/blog', '/contact'];
  const solutionRoutes = getAllSolutionSlugs().map((slug) => `/solutions/${slug}`);
  const docsRoutes = docsConfig.flatMap((library) =>
    library.sections.flatMap((section) =>
      section.pages.map((page) => `/docs/${library.id}/${page.section}/${page.slug}`),
    ),
  );
  const specialDocsRoutes = specialDocsPages.map((page) => page.path);
  const blogRoutes = getAllPosts().map((p) => `/blog/${p.slug}`);

  return [...staticRoutes, ...solutionRoutes, ...docsRoutes, ...specialDocsRoutes, ...blogRoutes];
}
