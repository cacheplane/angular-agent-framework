import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COCKPIT_DOCS_LINKS,
  COCKPIT_TOPICS_WITHOUT_DOCS,
  NO_COCKPIT_DOCS_LINK,
  cockpitManifest,
} from '@threadplane/cockpit-registry';
import { docsConfig } from '../../../website/src/lib/docs-config';

/**
 * Guard for the cockpit -> website documentation links.
 *
 * `docsPath` used to be generated from a five-segment formula that matched no
 * route the website has ever served, so every link 404'd and nothing noticed:
 * the shape was asserted against a regex, never against reality. This spec
 * checks each declared path against the website's real content tree and its
 * real nav config, so a docs rename breaks a test instead of a link.
 */

const findWorkspaceRoot = (): string => {
  let dir = process.cwd();
  while (dir !== resolve(dir, '..')) {
    if (existsSync(join(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('workspace root (nx.json) not found');
};

const WORKSPACE_ROOT = findWorkspaceRoot();
const DOCS_CONTENT_ROOT = join(WORKSPACE_ROOT, 'apps/website/content/docs');

/** Every `/docs/<library>/<section>/<slug>` the website's nav actually offers. */
const navRoutes = new Set(
  docsConfig.flatMap((library) =>
    library.sections.flatMap((section) =>
      section.pages.map((page) => `/docs/${library.id}/${section.id}/${page.slug}`)
    )
  )
);

/** Every `/docs/<library>/<section>/<slug>` backed by an `.mdx` file on disk. */
const contentRoutes = new Set<string>();
for (const library of readdirSync(DOCS_CONTENT_ROOT, { withFileTypes: true })) {
  if (!library.isDirectory()) continue;
  const libraryDir = join(DOCS_CONTENT_ROOT, library.name);
  for (const section of readdirSync(libraryDir, { withFileTypes: true })) {
    if (!section.isDirectory()) continue;
    const sectionDir = join(libraryDir, section.name);
    for (const file of readdirSync(sectionDir)) {
      if (!file.endsWith('.mdx')) continue;
      contentRoutes.add(
        `/docs/${library.name}/${section.name}/${file.slice(0, -'.mdx'.length)}`
      );
    }
  }
}

/**
 * Descriptors are duplicated per example (cockpit examples are standalone), so
 * they are read off disk rather than imported — an example whose module nobody
 * imports still has to declare a link that resolves.
 */
const readDescriptorDocsPaths = (): { file: string; key: string; docsPath: string }[] => {
  const results: { file: string; key: string; docsPath: string }[] = [];
  const cockpitRoot = join(WORKSPACE_ROOT, 'cockpit');
  for (const product of readdirSync(cockpitRoot, { withFileTypes: true })) {
    if (!product.isDirectory()) continue;
    const productDir = join(cockpitRoot, product.name);
    for (const topic of readdirSync(productDir, { withFileTypes: true })) {
      if (!topic.isDirectory()) continue;
      for (const lane of readdirSync(join(productDir, topic.name), { withFileTypes: true })) {
        if (!lane.isDirectory()) continue;
        const file = join(productDir, topic.name, lane.name, 'src/index.ts');
        if (!existsSync(file)) continue;
        const source = readFileSync(file, 'utf-8');
        const identity = /manifestIdentity:\s*\{[^}]*?product:\s*'([^']+)'[^}]*?section:\s*'([^']+)'[^}]*?topic:\s*'([^']+)'/s.exec(
          source
        );
        const declared = /\n {2}docsPath: '([^']*)',/.exec(source);
        if (!identity || !declared) continue;
        results.push({
          file: file.slice(WORKSPACE_ROOT.length + 1),
          key: `${identity[1]}/${identity[2]}/${identity[3]}`,
          docsPath: declared[1],
        });
      }
    }
  }
  return results;
};

const descriptors = readDescriptorDocsPaths();

describe('cockpit docs links', () => {
  it('reads a docs route list from the website that is not empty', () => {
    // Guards the guard: an empty derived list would let everything below pass.
    expect(navRoutes.size).toBeGreaterThan(50);
    expect(contentRoutes.size).toBeGreaterThan(50);
  });

  it('points every mapped capability at a page the website actually serves', () => {
    const broken = Object.entries(COCKPIT_DOCS_LINKS)
      .filter(([, path]) => path !== NO_COCKPIT_DOCS_LINK)
      .filter(([, path]) => !contentRoutes.has(path) || !navRoutes.has(path))
      .map(([key, path]) => `${key} -> ${path}`);

    expect(broken).toEqual([]);
  });

  it('blanks only the capabilities that are known to have no docs page', () => {
    const blanked = Object.entries(COCKPIT_DOCS_LINKS)
      .filter(([, path]) => path === NO_COCKPIT_DOCS_LINK)
      .map(([key]) => key)
      .sort();

    expect(blanked).toEqual([...COCKPIT_TOPICS_WITHOUT_DOCS].sort());
  });

  it('maps every manifest entry', () => {
    const unmapped = cockpitManifest
      .filter((entry) => !(`${entry.product}/${entry.section}/${entry.topic}` in COCKPIT_DOCS_LINKS))
      .map((entry) => `${entry.product}/${entry.section}/${entry.topic}`);

    expect(unmapped).toEqual([]);
  });

  it('keeps every per-example descriptor in step with the shared table', () => {
    expect(descriptors.length).toBeGreaterThan(60);

    const drifted = descriptors
      .filter(({ key, docsPath }) => docsPath !== COCKPIT_DOCS_LINKS[key])
      .map(({ file, key, docsPath }) => `${file}: ${key} declares ${docsPath || '(blank)'}`);

    expect(drifted).toEqual([]);
  });

  it('declares no five-segment legacy docs path anywhere', () => {
    const legacy = descriptors
      .filter(({ docsPath }) => docsPath.split('/').filter(Boolean).length > 4)
      .map(({ file, docsPath }) => `${file}: ${docsPath}`);

    expect(legacy).toEqual([]);
  });
});
