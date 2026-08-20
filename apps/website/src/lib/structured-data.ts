// SPDX-License-Identifier: MIT
import { DEFAULT_SOCIAL_IMAGE, getCanonicalUrl, resolveModifiedTime, SITE_NAME } from './site-metadata';
import { SHORT_POSITIONING_DESCRIPTION } from './positioning';

/** A single schema.org node, ready to be serialized into a `ld+json` script. */
export type JsonLdNode = Record<string, unknown>;

const SCHEMA_CONTEXT = 'https://schema.org';

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
 * Those references only resolve if the Organization node is present in the same
 * page's structured data. {@link rootJsonLd} is what guarantees that: it bundles
 * Organization with the other root nodes into one `@graph`, so a caller cannot
 * mount a referring node without its referent.
 *
 * Computed at module load, which is safe because {@link getCanonicalUrl}
 * resolves against a hardcoded `SITE_ORIGIN` constant — no env lookup, no
 * request context, identical on server and client.
 */
const ORGANIZATION_ID = `${getCanonicalUrl('/')}#organization`;

export function organizationJsonLd() {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: getCanonicalUrl('/'),
    // No `logo`: there is no square brand mark in the repo (the in-app LogoMark
    // renders an emoji), and the generated social card is a 1200x630 marketing
    // image, not a mark — it would satisfy Google's format floor while asserting
    // something false about the brand. Restore this property once a real square
    // mark ships in `public/logos/`.
    description:
      'Threadplane builds the Angular UI layer for production agent applications on LangGraph and AG-UI-compatible runtimes.',
    sameAs: [REPOSITORY_URL, 'https://www.npmjs.com/package/@threadplane/chat'],
  };
}

export function websiteJsonLd() {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebSite',
    '@id': `${getCanonicalUrl('/')}#website`,
    name: SITE_NAME,
    url: getCanonicalUrl('/'),
    description: SHORT_POSITIONING_DESCRIPTION,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function softwareSourceCodeJsonLd() {
  return {
    '@context': SCHEMA_CONTEXT,
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

/**
 * The site-wide nodes, bundled into a single `@graph` so they are physically
 * inseparable: mounting this cannot orphan the `@id` references that WebSite and
 * SoftwareSourceCode make to the Organization, because the Organization travels
 * with them. `@graph` is the conventional shape for a multi-entity page and
 * consumers parse it identically to sibling nodes.
 *
 * Mounted once, in the root layout.
 */
export function rootJsonLd() {
  // Annotated: the graph is deliberately heterogeneous, so `JsonLdNode[]` is the
  // honest element type. The individual builders keep their inferred shapes.
  const nodes: JsonLdNode[] = [organizationJsonLd(), websiteJsonLd(), softwareSourceCodeJsonLd()];
  return {
    '@context': SCHEMA_CONTEXT,
    // One `@context` for the whole graph; repeating it per node is redundant.
    // Per-route builders keep theirs, since they are mounted standalone.
    '@graph': nodes.map((node) => {
      const stripped = { ...node };
      delete stripped['@context'];
      return stripped;
    }),
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

export function blogPostingJsonLd(post: BlogPostingInput) {
  const url = getCanonicalUrl(`/blog/${post.slug}`);
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: url,
    datePublished: post.datePublished,
    dateModified: resolveModifiedTime(post.datePublished, post.dateModified),
    // TODO(task 9): switch to `<pathname>/opengraph-image` once that route
    // actually serves. It exists but currently 500s in production, and naming
    // it here would advertise a broken image — same call task 6 made for
    // og:image, kept consistent on purpose.
    image: getCanonicalUrl(DEFAULT_SOCIAL_IMAGE),
    // Omitted rather than left undefined, matching `dateModified` below.
    ...(post.tags?.length ? { keywords: post.tags } : {}),
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

export function techArticleJsonLd(doc: TechArticleInput) {
  const url = getCanonicalUrl(doc.pathname);
  return {
    '@context': SCHEMA_CONTEXT,
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

/** One rung of a breadcrumb trail, from the site root down to the current page. */
export interface BreadcrumbCrumb {
  name: string;
  pathname: string;
}

export function breadcrumbJsonLd(crumbs: BreadcrumbCrumb[]) {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: getCanonicalUrl(crumb.pathname),
    })),
  };
}
