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

export const docsCockpitMappings = {
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
