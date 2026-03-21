import type {
  CockpitManifestEntry,
  CockpitManifestIdentity,
  CockpitProduct,
} from './manifest.types';

const toTitle = (value: string): string =>
  value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const getProductTitle = (product: CockpitProduct): string =>
  product === 'deep-agents' ? 'Deep Agents' : 'LangGraph';

const getOverviewIdentity = (product: CockpitProduct): CockpitManifestIdentity => ({
  product,
  section: 'getting-started',
  topic: 'overview',
  page: 'overview',
  language: 'python',
});

const createEntry = (
  product: CockpitProduct,
  section: CockpitManifestEntry['section'],
  topic: string,
  entryKind: CockpitManifestEntry['entryKind']
): CockpitManifestEntry => {
  const page: CockpitManifestEntry['page'] = 'overview';
  const title =
    section === 'getting-started'
      ? `${getProductTitle(product)} Overview`
      : `${getProductTitle(product)} ${toTitle(topic)}`;

  return {
    product,
    section,
    topic,
    page,
    language: 'python',
    capabilityId: topic,
    title,
    summary: `${title} reference metadata`,
    officialDocsId: `${product}/${section}/${topic}`,
    canonicalLanguage: 'python',
    supportedLanguages: ['python'],
    equivalentPages: {
      python: {
        product,
        section,
        topic,
        page,
        language: 'python',
      },
    },
    fallbackTarget: getOverviewIdentity(product),
    entryKind,
    runtimeClass: entryKind === 'docs-only' ? 'docs-only' : 'local-service',
    docsPath: `/docs/${product}/${topic}`,
    promptAssetPaths: [],
    codeAssetPaths: [],
    implementationStatus: 'planned',
    docsStatus: 'planned',
    testStatus: 'planned',
    deploymentStatus: 'planned',
  };
};

export const cockpitManifest: CockpitManifestEntry[] = [
  createEntry('deep-agents', 'getting-started', 'overview', 'docs-only'),
  createEntry('deep-agents', 'core-capabilities', 'planning', 'capability'),
  createEntry('deep-agents', 'core-capabilities', 'filesystem', 'capability'),
  createEntry('deep-agents', 'core-capabilities', 'subagents', 'capability'),
  createEntry('deep-agents', 'core-capabilities', 'memory', 'capability'),
  createEntry('deep-agents', 'core-capabilities', 'skills', 'capability'),
  createEntry('deep-agents', 'core-capabilities', 'sandboxes', 'capability'),
  createEntry('langgraph', 'getting-started', 'overview', 'docs-only'),
  createEntry('langgraph', 'core-capabilities', 'persistence', 'capability'),
  createEntry('langgraph', 'core-capabilities', 'durable-execution', 'capability'),
  createEntry('langgraph', 'core-capabilities', 'streaming', 'capability'),
  createEntry('langgraph', 'core-capabilities', 'interrupts', 'capability'),
  createEntry('langgraph', 'core-capabilities', 'memory', 'capability'),
  createEntry('langgraph', 'core-capabilities', 'subgraphs', 'capability'),
  createEntry('langgraph', 'core-capabilities', 'time-travel', 'capability'),
  createEntry('langgraph', 'core-capabilities', 'deployment-runtime', 'capability'),
];
