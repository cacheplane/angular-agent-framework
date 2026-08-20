// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  rootJsonLd,
  softwareSourceCodeJsonLd,
  techArticleJsonLd,
  websiteJsonLd,
  blogPostingJsonLd,
  type JsonLdNode,
} from './structured-data';

const ORGANIZATION_ID = 'https://threadplane.ai/#organization';

const SAMPLE_POST = {
  title: 'A Post',
  description: 'About things.',
  slug: 'a-post',
  datePublished: '2026-08-13',
  authorName: 'Brian Love',
} as const;

const SAMPLE_DOC = {
  title: 'Installation',
  description: 'Install it.',
  pathname: '/docs/chat/getting-started/installation',
} as const;

/** Every builder's output must survive a JSON round-trip unchanged. */
function expectSerializable<T extends JsonLdNode>(data: T): Record<string, unknown> {
  const json = JSON.stringify(data);
  expect(() => JSON.parse(json)).not.toThrow();
  const parsed = JSON.parse(json) as Record<string, unknown>;
  // The real assertion: nothing is lost or invented by serialization. This is
  // what catches an `undefined`-valued key that `JSON.stringify` silently drops.
  expect(parsed).toStrictEqual(data);
  return parsed;
}

describe('organizationJsonLd', () => {
  it('describes Threadplane with an absolute url', () => {
    const data = organizationJsonLd();
    expect(data['@type']).toBe('Organization');
    expect(data['name']).toBe('Threadplane');
    expect(String(data['url'])).toBe('https://threadplane.ai/');
  });

  it('omits logo entirely rather than passing off the social card as a mark', () => {
    expect('logo' in organizationJsonLd()).toBe(false);
  });

  it('links only to absolute https profile urls', () => {
    const sameAs = organizationJsonLd()['sameAs'];
    expect(sameAs).toContain('https://github.com/cacheplane/angular-agent-framework');
    for (const url of sameAs) expect(url).toMatch(/^https:\/\//);
  });

  it('serializes to JSON', () => {
    expect(expectSerializable(organizationJsonLd())['@context']).toBe('https://schema.org');
  });
});

describe('websiteJsonLd', () => {
  it('is a WebSite node pointing at the origin', () => {
    expect(websiteJsonLd()['@type']).toBe('WebSite');
  });

  it('serializes to JSON', () => {
    expectSerializable(websiteJsonLd());
  });
});

describe('rootJsonLd', () => {
  it('bundles the three site-wide nodes into one @graph', () => {
    const graph = rootJsonLd()['@graph'];
    expect(graph.map((node) => node['@type'])).toEqual([
      'Organization',
      'WebSite',
      'SoftwareSourceCode',
    ]);
  });

  it('carries a single @context for the whole graph', () => {
    const data = rootJsonLd();
    expect(data['@context']).toBe('https://schema.org');
    for (const node of data['@graph']) expect('@context' in node).toBe(false);
  });

  it('resolves every @id reference inside the graph it ships', () => {
    const graph = rootJsonLd()['@graph'];
    const ids = new Set(graph.map((node) => node['@id']).filter(Boolean));
    expect(ids.has(ORGANIZATION_ID)).toBe(true);

    // The referring nodes point at a node that is physically in this same graph.
    const website = graph.find((node) => node['@type'] === 'WebSite');
    const software = graph.find((node) => node['@type'] === 'SoftwareSourceCode');
    expect((website?.['publisher'] as JsonLdNode)['@id']).toBe(ORGANIZATION_ID);
    expect((software?.['author'] as JsonLdNode)['@id']).toBe(ORGANIZATION_ID);
  });

  it('serializes to JSON', () => {
    expectSerializable(rootJsonLd());
  });
});

describe('blogPostingJsonLd', () => {
  it('carries headline, dates, author, and absolute urls', () => {
    const data = blogPostingJsonLd({ ...SAMPLE_POST, tags: ['angular'] });
    expect(data['@type']).toBe('BlogPosting');
    expect(data['headline']).toBe('A Post');
    expect(data['datePublished']).toBe('2026-08-13');
    expect(data['dateModified']).toBe('2026-08-13');
    expect(data['author']['name']).toBe('Brian Love');
    expect(String(data['url'])).toBe('https://threadplane.ai/blog/a-post');
  });

  it('prefers an explicit dateModified when one is known', () => {
    const data = blogPostingJsonLd({ ...SAMPLE_POST, dateModified: '2026-08-19' });
    expect(data['dateModified']).toBe('2026-08-19');
  });

  it('emits an absolute image url', () => {
    expect(String(blogPostingJsonLd(SAMPLE_POST)['image'])).toMatch(/^https:\/\/threadplane\.ai\//);
  });

  it('omits keywords entirely for an untagged post', () => {
    expect('keywords' in blogPostingJsonLd(SAMPLE_POST)).toBe(false);
    expect('keywords' in blogPostingJsonLd({ ...SAMPLE_POST, tags: [] })).toBe(false);
  });

  it('serializes to JSON', () => {
    expectSerializable(blogPostingJsonLd(SAMPLE_POST));
    expectSerializable(blogPostingJsonLd({ ...SAMPLE_POST, tags: ['angular'] }));
  });
});

describe('techArticleJsonLd', () => {
  it('describes a docs page', () => {
    const data = techArticleJsonLd(SAMPLE_DOC);
    expect(data['@type']).toBe('TechArticle');
    expect(String(data['url'])).toBe('https://threadplane.ai/docs/chat/getting-started/installation');
  });

  it('omits dateModified entirely when none is known', () => {
    expect('dateModified' in techArticleJsonLd(SAMPLE_DOC)).toBe(false);
  });

  it('serializes to JSON', () => {
    expectSerializable(techArticleJsonLd(SAMPLE_DOC));
    expectSerializable(techArticleJsonLd({ ...SAMPLE_DOC, dateModified: '2026-08-19' }));
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers positions from 1 and resolves absolute urls', () => {
    const items = breadcrumbJsonLd([
      { name: 'Docs', pathname: '/docs' },
      { name: 'Chat', pathname: '/docs/chat' },
    ])['itemListElement'];
    expect(items).toHaveLength(2);
    expect(items[0]['position']).toBe(1);
    expect(String(items[1]['item'])).toBe('https://threadplane.ai/docs/chat');
  });

  it('emits an empty itemListElement for an empty trail', () => {
    // Documenting, not endorsing: Google rejects a BreadcrumbList with no items.
    // No runtime guard here on purpose — task 8 owns the call sites and must not
    // hand this builder an empty array.
    expect(breadcrumbJsonLd([])['itemListElement']).toEqual([]);
  });

  it('serializes to JSON', () => {
    expectSerializable(breadcrumbJsonLd([{ name: 'Docs', pathname: '/docs' }]));
  });
});

describe('softwareSourceCodeJsonLd', () => {
  it('marks Threadplane as an Angular TypeScript library', () => {
    const data = softwareSourceCodeJsonLd();
    expect(data['@type']).toBe('SoftwareSourceCode');
    expect(data['programmingLanguage']).toBe('TypeScript');
  });

  it('points at the real repository', () => {
    expect(softwareSourceCodeJsonLd()['codeRepository']).toBe(
      'https://github.com/cacheplane/angular-agent-framework',
    );
  });

  it('serializes to JSON', () => {
    expectSerializable(softwareSourceCodeJsonLd());
  });
});

/**
 * Cross-cutting invariants. Asserting these per-builder is what stops one
 * builder from quietly drifting — a dropped `@context` or a `#Organization`
 * typo in a single node would otherwise sail through.
 */
describe('shared node invariants', () => {
  const standaloneBuilders: [string, () => JsonLdNode][] = [
    ['organizationJsonLd', organizationJsonLd],
    ['websiteJsonLd', websiteJsonLd],
    ['softwareSourceCodeJsonLd', softwareSourceCodeJsonLd],
    ['blogPostingJsonLd', () => blogPostingJsonLd(SAMPLE_POST)],
    ['techArticleJsonLd', () => techArticleJsonLd(SAMPLE_DOC)],
    ['breadcrumbJsonLd', () => breadcrumbJsonLd([{ name: 'Docs', pathname: '/docs' }])],
  ];

  it.each(standaloneBuilders)('%s declares the schema.org @context', (_name, build) => {
    expect(build()['@context']).toBe('https://schema.org');
  });

  it.each(standaloneBuilders)('%s declares an @type', (_name, build) => {
    expect(typeof build()['@type']).toBe('string');
  });

  // Every node that names the Organization must name the *same* Organization.
  const organizationReferences: [string, string, () => JsonLdNode][] = [
    ['websiteJsonLd', 'publisher', websiteJsonLd],
    ['softwareSourceCodeJsonLd', 'author', softwareSourceCodeJsonLd],
    ['blogPostingJsonLd', 'publisher', () => blogPostingJsonLd(SAMPLE_POST)],
    ['techArticleJsonLd', 'author', () => techArticleJsonLd(SAMPLE_DOC)],
    ['techArticleJsonLd', 'publisher', () => techArticleJsonLd(SAMPLE_DOC)],
  ];

  it.each(organizationReferences)('%s.%s references the Organization by @id', (_name, key, build) => {
    expect((build()[key] as JsonLdNode)['@id']).toBe(ORGANIZATION_ID);
  });

  it('references the id the Organization node actually declares', () => {
    expect(organizationJsonLd()['@id']).toBe(ORGANIZATION_ID);
  });
});
