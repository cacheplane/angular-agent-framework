import type { CockpitManifestIdentity } from '@threadplane/cockpit-registry';
import type { ControlPlaneMode } from '@threadplane/ui-react';
import type { AnalyticsLibrary } from './analytics/events';

export interface DocsIdentity {
  library: string;
  section: string;
  slug: string;
}

export const COCKPIT_ENVIRONMENT_LABEL =
  process.env.NEXT_PUBLIC_COCKPIT_ENVIRONMENT_LABEL ?? 'Shared development';

/**
 * Documentation page -> Cockpit capability (the reverse of
 * `COCKPIT_DOCS_LINKS` in `@threadplane/cockpit-registry`).
 *
 * Keyed by `${library}/${section}/${slug}` — the three segments of the docs
 * route, `/docs/<library>/<section>/<slug>`. Values are a full Cockpit
 * identity, because the Cockpit route carries five segments; the extra two are
 * fixed (`page: 'overview'`, `language: 'python'`) for every manifest entry
 * today, so they are written out rather than derived.
 *
 * Rules for this table:
 *
 * - An unmapped page is not an error. `resolveCockpitIdentity` returns null and
 *   the control plane sends the reader to Cockpit home instead of guessing a
 *   URL — the five-segment formula 404s for pages that have no demo.
 * - Several docs pages may share one Cockpit target. The runtimes library
 *   documents each runtime across three pages (overview, quickstart,
 *   how-it-connects) that one demo serves equally well.
 * - An `introduction` maps to its product's `getting-started/overview` entry.
 *   Those entries are `entryKind: 'docs-only'` in the manifest, so Run mode
 *   lands on the product's Cockpit overview rather than a live demo — still a
 *   better destination than Cockpit home, and it keeps the Capability row
 *   truthful.
 * - The spec pins this object exactly and cross-checks every target against
 *   `cockpitManifest`, so a Cockpit topic rename breaks the test rather than
 *   the link.
 */
export const docsCockpitMappings = {
  'deep-agents/getting-started/introduction': {
    product: 'deep-agents',
    section: 'getting-started',
    topic: 'overview',
    page: 'overview',
    language: 'python',
  },
  'deep-agents/capabilities/planning': {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'planning',
    page: 'overview',
    language: 'python',
  },
  'deep-agents/capabilities/filesystem': {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'filesystem',
    page: 'overview',
    language: 'python',
  },
  'deep-agents/capabilities/subagents': {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'subagents',
    page: 'overview',
    language: 'python',
  },
  'deep-agents/capabilities/memory': {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'memory',
    page: 'overview',
    language: 'python',
  },
  'deep-agents/capabilities/skills': {
    product: 'deep-agents',
    section: 'core-capabilities',
    topic: 'skills',
    page: 'overview',
    language: 'python',
  },
  'runtimes/getting-started/introduction': {
    product: 'runtimes',
    section: 'getting-started',
    topic: 'overview',
    page: 'overview',
    language: 'python',
  },
  'runtimes/aws-strands/overview': {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'aws-strands',
    page: 'overview',
    language: 'python',
  },
  'runtimes/aws-strands/quickstart': {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'aws-strands',
    page: 'overview',
    language: 'python',
  },
  'runtimes/aws-strands/how-it-connects': {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'aws-strands',
    page: 'overview',
    language: 'python',
  },
  'runtimes/microsoft-agent-framework/overview': {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'microsoft-agent-framework',
    page: 'overview',
    language: 'python',
  },
  'runtimes/microsoft-agent-framework/quickstart': {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'microsoft-agent-framework',
    page: 'overview',
    language: 'python',
  },
  'runtimes/microsoft-agent-framework/how-it-connects': {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'microsoft-agent-framework',
    page: 'overview',
    language: 'python',
  },
  // The Mastra demo's backend is a Node AG-UI service, but the Cockpit route
  // is `python` like every other manifest entry — the language segment names
  // the Cockpit lane, not the runtime.
  'runtimes/mastra/overview': {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'mastra',
    page: 'overview',
    language: 'python',
  },
  'runtimes/mastra/quickstart': {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'mastra',
    page: 'overview',
    language: 'python',
  },
  'runtimes/mastra/how-it-connects': {
    product: 'runtimes',
    section: 'core-capabilities',
    topic: 'mastra',
    page: 'overview',
    language: 'python',
  },
  'langgraph/guides/streaming': {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'streaming',
    page: 'overview',
    language: 'python',
  },
  'langgraph/guides/deployment': {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'deployment-runtime',
    page: 'overview',
    language: 'python',
  },
  'render/guides/specs': {
    product: 'render',
    section: 'core-capabilities',
    topic: 'spec-rendering',
    page: 'overview',
    language: 'python',
  },
  'render/guides/registry': {
    product: 'render',
    section: 'core-capabilities',
    topic: 'registry',
    page: 'overview',
    language: 'python',
  },
  'chat/guides/generative-ui': {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'generative-ui',
    page: 'overview',
    language: 'python',
  },
} satisfies Record<string, CockpitManifestIdentity>;

const docsKey = (library: string, section: string, slug: string) =>
  `${library}/${section}/${slug}`;

export const resolveCockpitIdentity = (
  library: string,
  section: string,
  slug: string,
): CockpitManifestIdentity | null =>
  docsCockpitMappings[
    docsKey(library, section, slug) as keyof typeof docsCockpitMappings
  ] ?? null;

export type CockpitHandoffProperties = {
  library: AnalyticsLibrary;
  source_section: string;
  source_slug: string;
  destination_product?: string;
  destination_capability?: string;
  requested_mode: Lowercase<Exclude<ControlPlaneMode, 'Docs'>>;
  mapped: boolean;
};

const toAnalyticsLibrary = (library: string): AnalyticsLibrary => {
  switch (library) {
    case 'langgraph':
    case 'render':
    case 'chat':
    case 'ag-ui':
    case 'deep-agents':
    case 'runtimes':
      return library;
    default:
      return 'unknown';
  }
};

export const buildCockpitHandoffProperties = (
  identity: DocsIdentity,
  mode: Exclude<ControlPlaneMode, 'Docs'>,
): CockpitHandoffProperties => {
  const target = resolveCockpitIdentity(identity.library, identity.section, identity.slug);
  const source = {
    library: toAnalyticsLibrary(identity.library),
    source_section: identity.section,
    source_slug: identity.slug,
    requested_mode: mode.toLowerCase() as CockpitHandoffProperties['requested_mode'],
  };

  return target
    ? {
        ...source,
        destination_product: target.product,
        destination_capability: target.topic,
        mapped: true,
      }
    : { ...source, mapped: false };
};

const cockpitPath = (target: CockpitManifestIdentity) =>
  `/${target.product}/${target.section}/${target.topic}/${target.page}/${target.language}`;

export const buildCockpitModeHref = (
  identity: DocsIdentity,
  mode: Exclude<ControlPlaneMode, 'Docs'>,
  baseUrl = process.env.NEXT_PUBLIC_COCKPIT_BASE_URL ?? 'https://cockpit.threadplane.ai',
): string => {
  const target = resolveCockpitIdentity(identity.library, identity.section, identity.slug);
  const url = new URL(target ? cockpitPath(target) : '/', baseUrl);
  url.searchParams.set('mode', mode.toLowerCase());
  return url.toString();
};
