// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  softwareSourceCodeJsonLd,
  techArticleJsonLd,
  websiteJsonLd,
  blogPostingJsonLd,
  type JsonLdNode,
} from './structured-data';

/** Every builder's output must survive a JSON round-trip unchanged. */
function expectSerializable(data: JsonLdNode): Record<string, unknown> {
  const json = JSON.stringify(data);
  expect(() => JSON.parse(json)).not.toThrow();
  return JSON.parse(json) as Record<string, unknown>;
}

describe('organizationJsonLd', () => {
  it('describes Threadplane with an absolute url and logo', () => {
    const data = organizationJsonLd();
    expect(data['@type']).toBe('Organization');
    expect(data['name']).toBe('Threadplane');
    expect(String(data['url'])).toBe('https://threadplane.ai/');
    expect(String(data['logo'])).toMatch(/^https:\/\/threadplane\.ai\//);
  });

  it('only links to profiles that exist', () => {
    const sameAs = organizationJsonLd()['sameAs'] as string[];
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

  it('attributes the site to the Organization node', () => {
    const publisher = websiteJsonLd()['publisher'] as Record<string, unknown>;
    expect(publisher['@id']).toBe(organizationJsonLd()['@id']);
  });

  it('serializes to JSON', () => {
    expectSerializable(websiteJsonLd());
  });
});

describe('blogPostingJsonLd', () => {
  it('carries headline, dates, author, and absolute urls', () => {
    const data = blogPostingJsonLd({
      title: 'A Post',
      description: 'About things.',
      slug: 'a-post',
      datePublished: '2026-08-13',
      authorName: 'Brian Love',
      tags: ['angular'],
    });
    expect(data['@type']).toBe('BlogPosting');
    expect(data['headline']).toBe('A Post');
    expect(data['datePublished']).toBe('2026-08-13');
    expect(data['dateModified']).toBe('2026-08-13');
    expect((data['author'] as Record<string, unknown>)['name']).toBe('Brian Love');
    expect(String(data['url'])).toBe('https://threadplane.ai/blog/a-post');
  });

  it('prefers an explicit dateModified when one is known', () => {
    const data = blogPostingJsonLd({
      title: 'A Post',
      description: 'About things.',
      slug: 'a-post',
      datePublished: '2026-08-13',
      dateModified: '2026-08-19',
      authorName: 'Brian Love',
    });
    expect(data['dateModified']).toBe('2026-08-19');
  });

  it('emits an absolute image url', () => {
    const data = blogPostingJsonLd({
      title: 'A Post',
      description: 'About things.',
      slug: 'a-post',
      datePublished: '2026-08-13',
      authorName: 'Brian Love',
    });
    expect(String(data['image'])).toMatch(/^https:\/\/threadplane\.ai\//);
  });

  it('serializes to JSON', () => {
    expectSerializable(
      blogPostingJsonLd({
        title: 'A Post',
        description: 'About things.',
        slug: 'a-post',
        datePublished: '2026-08-13',
        authorName: 'Brian Love',
      }),
    );
  });
});

describe('techArticleJsonLd', () => {
  it('describes a docs page', () => {
    const data = techArticleJsonLd({
      title: 'Installation',
      description: 'Install it.',
      pathname: '/docs/chat/getting-started/installation',
    });
    expect(data['@type']).toBe('TechArticle');
    expect(String(data['url'])).toBe('https://threadplane.ai/docs/chat/getting-started/installation');
  });

  it('omits dateModified entirely when none is known', () => {
    const data = techArticleJsonLd({
      title: 'Installation',
      description: 'Install it.',
      pathname: '/docs/chat/getting-started/installation',
    });
    expect('dateModified' in data).toBe(false);
  });

  it('serializes to JSON', () => {
    expectSerializable(
      techArticleJsonLd({ title: 'Installation', description: 'Install it.', pathname: '/docs' }),
    );
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers positions from 1 and resolves absolute urls', () => {
    const data = breadcrumbJsonLd([
      { name: 'Docs', pathname: '/docs' },
      { name: 'Chat', pathname: '/docs/chat' },
    ]);
    const items = data['itemListElement'] as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    expect(items[0]['position']).toBe(1);
    expect(String(items[1]['item'])).toBe('https://threadplane.ai/docs/chat');
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
