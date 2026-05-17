import type { Metadata } from 'next';
import { getAllSolutionSlugs } from './solutions-data';
import { docsConfig } from './docs-config';
import { getAllPosts } from './blog';

export const SITE_ORIGIN = 'https://cacheplane.ai';
export const SITE_NAME = 'Agent UI for Angular';
export const DEFAULT_SOCIAL_IMAGE = '/opengraph-image';

export function getCanonicalPath(pathname: string): string {
  if (pathname === '/') return '/';
  return `/${pathname.replace(/^\/+|\/+$/g, '')}`;
}

export function getCanonicalUrl(pathname: string): string {
  return new URL(getCanonicalPath(pathname), SITE_ORIGIN).toString();
}

export function createPageMetadata({
  title,
  description,
  pathname,
  type = 'article',
}: {
  title: string;
  description: string;
  pathname: string;
  type?: 'article' | 'website';
}): Metadata {
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
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
  };
}

export function getSitemapRoutes(): string[] {
  const staticRoutes = ['/', '/angular', '/render', '/chat', '/pricing', '/solutions', '/pilot-to-prod', '/docs', '/blog'];
  const solutionRoutes = getAllSolutionSlugs().map((slug) => `/solutions/${slug}`);
  const docsRoutes = docsConfig.flatMap((library) =>
    library.sections.flatMap((section) =>
      section.pages.map((page) => `/docs/${library.id}/${page.section}/${page.slug}`),
    ),
  );
  const blogRoutes = getAllPosts().map((p) => `/blog/${p.slug}`);

  return [...staticRoutes, ...solutionRoutes, ...docsRoutes, ...blogRoutes];
}
