import type { CockpitManifestIdentity } from '@threadplane/cockpit-registry';
import type { ControlPlaneMode } from '@threadplane/ui-react';

export interface DocsIdentity {
  library: string;
  section: string;
  slug: string;
}

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
