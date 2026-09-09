import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NAV_TRIGGERS, navItems } from './nav-config';
import { docsConfig } from '../../lib/docs-config';
import { getAllSolutionSlugs } from '../../lib/solutions-data';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app');

/**
 * `/docs/:library/:section/:slug` is a dynamic route, so a page file cannot
 * prove it exists. `docsConfig` is what the route renders from, so that is
 * what a docs href has to be checked against.
 */
function docsHrefResolves(href: string): boolean {
  if (href === '/docs') return true;
  const [, , library, section, slug] = href.split('/');
  if (!library) return false;
  if (!section) return existsSync(join(APP_ROOT, 'docs', library, 'page.tsx'));
  return docsConfig.some(
    (entry) =>
      entry.id === library &&
      entry.sections.some(
        (group) =>
          group.id === section && group.pages.some((page) => page.slug === slug),
      ),
  );
}

function staticHrefResolves(href: string): boolean {
  return existsSync(join(APP_ROOT, ...href.split('/').filter(Boolean), 'page.tsx'));
}

/**
 * `/solutions/:slug` is a dynamic route, so — like docs — a page file cannot
 * prove it exists. `getAllSolutionSlugs()` is what `generateStaticParams`
 * renders from, so that is what a solutions href has to be checked against.
 */
function solutionsHrefResolves(href: string): boolean {
  if (href === '/solutions') return true;
  const [, , slug] = href.split('/');
  return Boolean(slug) && getAllSolutionSlugs().includes(slug);
}

describe('nav-config', () => {
  it('points every internal link at a route that exists', () => {
    const unresolved = navItems()
      .filter((item) => !item.external)
      .filter((item) => {
        if (item.href.startsWith('/docs')) return !docsHrefResolves(item.href);
        if (item.href.startsWith('/solutions')) return !solutionsHrefResolves(item.href);
        return !staticHrefResolves(item.href);
      })
      .map((item) => `${item.label} → ${item.href}`);

    expect(unresolved).toEqual([]);
  });

  it('sends every external link somewhere over https', () => {
    const bad = navItems()
      .filter((item) => item.external)
      .filter((item) => !item.href.startsWith('https://'))
      .map((item) => item.label);

    expect(bad).toEqual([]);
  });

  it('gives every destination a unique analytics id', () => {
    const ids = navItems().map((item) => item.ctaId);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every panel item a label and a description', () => {
    const thin = navItems()
      .filter((item) => !item.label.trim() || !item.description.trim())
      .map((item) => item.ctaId);

    expect(thin).toEqual([]);
  });

  it('names four triggers, in order', () => {
    expect(NAV_TRIGGERS.map((trigger) => trigger.label)).toEqual([
      'Libraries',
      'Docs',
      'Solutions',
      'Pricing',
    ]);
  });
});
