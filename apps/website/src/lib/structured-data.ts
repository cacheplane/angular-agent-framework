// SPDX-License-Identifier: MIT
import { DEFAULT_SOCIAL_IMAGE, getCanonicalUrl, SITE_NAME } from './site-metadata';
import { SHORT_POSITIONING_DESCRIPTION } from './positioning';

/** A single schema.org node, ready to be serialized into a `ld+json` script. */
export type JsonLdNode = Record<string, unknown>;

/**
 * The canonical repository. Verified public; the npm *organization* page is
 * member-gated, so `sameAs` links the public package page instead.
 */
const REPOSITORY_URL = 'https://github.com/cacheplane/angular-agent-framework';

/**
 * Stable identity for the publisher node. Every other node refers to the
 * Organization by `@id` rather than repeating it, which is the schema.org way
 * to express "same entity" across nodes.
 *
 * COUPLING: those references only resolve if the Organization node itself is
 * present in the page's structured data. It is mounted once in the root layout
 * (task 8), so it is on every route; if that mount is ever removed, these
 * references become dangling.
 *
 * Computed at module load, which is safe because {@link getCanonicalUrl}
 * resolves against a hardcoded `SITE_ORIGIN` constant — no env lookup, no
 * request context, identical on server and client.
 */
const ORGANIZATION_ID = `${getCanonicalUrl('/')}#organization`;

export function organizationJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: getCanonicalUrl('/'),
    // No standalone brand mark exists yet (the in-app LogoMark is inline JSX),
    // so this points at the generated site social card: a real, crawlable PNG
    // carrying the wordmark. Swap in a dedicated mark when one ships.
    logo: getCanonicalUrl(DEFAULT_SOCIAL_IMAGE),
    description:
      'Threadplane builds the Angular UI layer for production agent applications on LangGraph and AG-UI-compatible runtimes.',
    sameAs: [REPOSITORY_URL, 'https://www.npmjs.com/package/@threadplane/chat'],
  };
}

export function websiteJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${getCanonicalUrl('/')}#website`,
    name: SITE_NAME,
    url: getCanonicalUrl('/'),
    description: SHORT_POSITIONING_DESCRIPTION,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function softwareSourceCodeJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: '@threadplane/chat',
    description:
      'Signal-native Angular chat UI primitives bound to a runtime-neutral Agent contract, with adapters for LangGraph and AG-UI.',
    programmingLanguage: 'TypeScript',
    runtimePlatform: 'Angular',
    codeRepository: REPOSITORY_URL,
    author: { '@id': ORGANIZATION_ID },
    license: getCanonicalUrl('/docs/licensing'),
  };
}

/** The subset of a blog post that schema.org cares about. */
export interface BlogPostingInput {
  title: string;
  description: string;
  slug: string;
  /** ISO 8601 publish date or timestamp. */
  datePublished: string;
  /** ISO 8601 last-modified timestamp; falls back to `datePublished`. */
  dateModified?: string;
  authorName: string;
  tags?: string[];
}

export function blogPostingJsonLd(post: BlogPostingInput): JsonLdNode {
  const url = getCanonicalUrl(`/blog/${post.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: url,
    datePublished: post.datePublished,
    // Same "unmodified" rule the OpenGraph metadata uses: a post with no known
    // modification advertises its publish date.
    dateModified: post.dateModified ?? post.datePublished,
    // TODO(task 9): switch to `<pathname>/opengraph-image` once that route
    // actually serves. It exists but currently 500s in production, and naming
    // it here would advertise a broken image — same call task 6 made for
    // og:image, kept consistent on purpose.
    image: getCanonicalUrl(DEFAULT_SOCIAL_IMAGE),
    keywords: post.tags,
    // No `url` on the author until /about exists (task 11); a 404 author URL is
    // worse than an unlinked name.
    author: { '@type': 'Person', name: post.authorName },
    publisher: { '@id': ORGANIZATION_ID },
  };
}

/** The subset of a docs page that schema.org cares about. */
export interface TechArticleInput {
  title: string;
  description: string;
  pathname: string;
  /** ISO 8601 last-modified timestamp; omitted from the node when unknown. */
  dateModified?: string;
}

export function techArticleJsonLd(doc: TechArticleInput): JsonLdNode {
  const url = getCanonicalUrl(doc.pathname);
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: doc.title,
    description: doc.description,
    url,
    mainEntityOfPage: url,
    ...(doc.dateModified ? { dateModified: doc.dateModified } : {}),
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    proficiencyLevel: 'Expert',
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; pathname: string }[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: getCanonicalUrl(crumb.pathname),
    })),
  };
}
