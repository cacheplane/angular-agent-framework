import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { capabilityModules } from '@threadplane/cockpit-registry';
import { describe, expect, it } from 'vitest';
import {
  resolveExampleFile,
  sliceRegion,
  type ExampleCodeContext,
} from './example-code';

/**
 * Every docs page that embeds a runnable example teaches through that
 * example: it includes code with `<ExampleCode>`, and every include resolves
 * against the capability's declared assets by the same rule the component
 * uses at build time. Docs-only pages never include.
 *
 * PENDING_PAGES lists mapped pages not yet rewritten. Each product PR removes
 * its pages; a page that gains an include must leave the list in the same PR.
 *
 * The scan is textual: the tag must not appear in prose, fenced code, or MDX
 * comments on any docs page, or it counts as an include.
 */
const PENDING_PAGES = new Set<string>([
  '/docs/a2ui/getting-started/introduction',
  '/docs/ag-ui/guides/client-tools',
  '/docs/ag-ui/guides/interrupts',
  '/docs/ag-ui/guides/json-render',
  '/docs/ag-ui/guides/subagents',
  '/docs/ag-ui/guides/tool-views',
  '/docs/ag-ui/reference/event-mapping',
  '/docs/chat/a2ui/overview',
  '/docs/chat/components/chat-debug',
  '/docs/chat/components/chat-input',
  '/docs/chat/components/chat-interrupt-panel',
  '/docs/chat/components/chat-subagent-card',
  '/docs/chat/components/chat-tool-calls',
  '/docs/chat/components/chat-trace',
  '/docs/chat/concepts/message-model',
  '/docs/chat/guides/client-tools',
  '/docs/chat/guides/generative-ui',
  '/docs/chat/guides/theming',
  '/docs/chat/guides/thread-routing',
  '/docs/deep-agents/capabilities/filesystem',
  '/docs/deep-agents/capabilities/memory',
  '/docs/deep-agents/capabilities/planning',
  '/docs/deep-agents/capabilities/skills',
  '/docs/deep-agents/capabilities/subagents',
  '/docs/langgraph/guides/deployment',
  '/docs/langgraph/guides/durable-execution',
  '/docs/langgraph/guides/memory',
  '/docs/langgraph/guides/subgraphs',
  '/docs/langgraph/guides/time-travel',
  '/docs/render/api/provide-render',
  '/docs/render/api/render-spec-component',
  '/docs/render/guides/registry',
  '/docs/render/guides/repeat-loops',
  '/docs/render/guides/specs',
  '/docs/render/guides/state-store',
  '/docs/runtimes/aws-strands/overview',
  '/docs/runtimes/mastra/overview',
  '/docs/runtimes/microsoft-agent-framework/overview',
]);

const findWorkspaceRoot = (): string => {
  let directory = process.cwd();
  while (directory !== resolve(directory, '..')) {
    if (existsSync(join(directory, 'nx.json'))) return directory;
    directory = resolve(directory, '..');
  }
  throw new Error('workspace root (nx.json) not found');
};
const WORKSPACE_ROOT = findWorkspaceRoot();
const CONTENT_ROOT = join(WORKSPACE_ROOT, 'apps/website/content');

interface MappedPage {
  readonly docsPath: string;
  readonly assetPaths: readonly string[];
}

/** docsPath → union of code assets across every descriptor sharing it. */
function mappedPages(): MappedPage[] {
  const byPath = new Map<string, Set<string>>();
  for (const descriptor of capabilityModules) {
    const assets = [
      ...descriptor.codeAssetPaths,
      ...(descriptor.backendAssetPaths ?? []),
    ];
    if (assets.length === 0) continue;
    const set = byPath.get(descriptor.docsPath) ?? new Set<string>();
    for (const asset of assets) set.add(asset);
    byPath.set(descriptor.docsPath, set);
  }
  return [...byPath].map(([docsPath, assets]) => ({
    docsPath,
    assetPaths: [...assets],
  }));
}

function mdxFor(docsPath: string): string {
  return readFileSync(join(CONTENT_ROOT, `${docsPath}.mdx`), 'utf8');
}

function contextFor(page: MappedPage): ExampleCodeContext {
  const sources: Record<string, string> = {};
  for (const path of page.assetPaths) {
    const full = join(WORKSPACE_ROOT, path);
    if (existsSync(full)) sources[path] = readFileSync(full, 'utf8');
  }
  return { docsPath: page.docsPath, assetPaths: page.assetPaths, sources };
}

interface Include {
  readonly file: string;
  readonly region?: string;
}

function includesIn(mdx: string): Include[] {
  return [...mdx.matchAll(/<ExampleCode\b([^>]*?)\/?>/g)].map(([, attrs]) => ({
    file: /\bfile="([^"]+)"/.exec(attrs)?.[1] ?? '',
    region: /\bregion="([^"]+)"/.exec(attrs)?.[1],
  }));
}

function allDocsMdx(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.mdx') ? [path] : [];
    });
  return walk(join(CONTENT_ROOT, 'docs'));
}

describe('docs pages teach through their example', () => {
  const pages = mappedPages();
  const mappedPaths = new Set(pages.map((page) => page.docsPath));

  it('sees the registry and the content tree', () => {
    expect(pages.length).toBeGreaterThan(30);
    expect(allDocsMdx().length).toBeGreaterThan(50);
  });

  it('has an MDX file for every mapped page', () => {
    for (const page of pages) {
      expect(
        existsSync(join(CONTENT_ROOT, `${page.docsPath}.mdx`)),
        page.docsPath
      ).toBe(true);
    }
  });

  it('lists only mapped pages as pending, and none that already include', () => {
    for (const pending of PENDING_PAGES) {
      expect(mappedPaths.has(pending), `${pending} is not a mapped page`).toBe(
        true
      );
      expect(
        includesIn(mdxFor(pending)),
        `${pending} includes code; remove it from PENDING_PAGES`
      ).toEqual([]);
    }
  });

  it('includes at least one example file on every rewritten mapped page', () => {
    const missing = pages
      .filter((page) => !PENDING_PAGES.has(page.docsPath))
      .filter((page) => includesIn(mdxFor(page.docsPath)).length === 0)
      .map((page) => page.docsPath);
    expect(
      missing,
      'mapped pages with no <ExampleCode>; rewrite them or add them to PENDING_PAGES'
    ).toEqual([]);
  });

  it('resolves every include against the capability assets', () => {
    for (const page of pages) {
      const context = contextFor(page);
      for (const include of includesIn(mdxFor(page.docsPath))) {
        const { file, region } = include;
        const label = `${page.docsPath} <ExampleCode file="${file}">`;
        expect(file, label).not.toBe('');
        const path = resolveExampleFile(file, context);
        if (region) {
          expect(
            () => sliceRegion(context.sources[path], region, path),
            label
          ).not.toThrow();
        }
      }
    }
  });

  it('never includes on a docs-only page', () => {
    const offenders = allDocsMdx()
      .map((file) => '/' + relative(CONTENT_ROOT, file).replace(/\.mdx$/, ''))
      .filter((docsPath) => !mappedPaths.has(docsPath))
      .filter((docsPath) => includesIn(mdxFor(docsPath)).length > 0);
    expect(offenders, 'docs-only pages must not use <ExampleCode>').toEqual([]);
  });
});
