import type {
  CockpitManifestEntry,
  CockpitManifestIdentity,
  CockpitProduct,
  CockpitRuntimeClass,
} from './manifest.types';

const APPROVED_TOPICS = {
  'deep-agents': {
    'getting-started': ['overview'],
    'core-capabilities': [
      'planning',
      'filesystem',
      'subagents',
      'memory',
      'skills',
      'sandboxes',
    ],
  },
  langgraph: {
    'getting-started': ['overview'],
    'core-capabilities': [
      'persistence',
      'durable-execution',
      'streaming',
      'interrupts',
      'memory',
      'subgraphs',
      'time-travel',
      'deployment-runtime',
    ],
  },
  render: {
    'getting-started': ['overview'],
    'core-capabilities': [
      'spec-rendering',
      'element-rendering',
      'state-management',
      'registry',
      'repeat-loops',
      'computed-functions',
    ],
  },
  chat: {
    'getting-started': ['overview'],
    'core-capabilities': [
      'messages',
      'input',
      'interrupts',
      'tool-calls',
      'subagents',
      'threads',
      'timeline',
      'generative-ui',
      'debug',
      'theming',
    ],
  },
} as const;

const toTitle = (value: string): string =>
  value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const getProductTitle = (product: CockpitProduct): string => {
  switch (product) {
    case 'deep-agents':
      return 'Deep Agents';
    case 'langgraph':
      return 'LangGraph';
    case 'render':
      return 'Render';
    case 'chat':
      return 'Chat';
  }
};

const getOverviewIdentity = (product: CockpitProduct): CockpitManifestIdentity => ({
  product,
  section: 'getting-started',
  topic: 'overview',
  page: 'overview',
  language: 'python',
});

const getDocsPath = (
  product: CockpitProduct,
  section: CockpitManifestEntry['section'],
  topic: string
): string => `/docs/${product}/${section}/${topic}/overview/python`;

const getPromptAssetPath = (product: CockpitProduct, topic: string): string =>
  `cockpit/${product}/${topic}/python/prompts/${topic}.md`;

const getCodeAssetPath = (product: CockpitProduct, topic: string): string =>
  `cockpit/${product}/${topic}/python/src/index.ts`;

const getSmokeTarget = (product: CockpitProduct, topic: string): string =>
  `cockpit-${product}-${topic}-python:smoke`;

const getIntegrationTarget = (
  product: CockpitProduct,
  topic: string
): string | null =>
  product === 'langgraph' && topic === 'deployment-runtime'
    ? 'cockpit-langgraph-deployment-runtime-python:integration'
    : null;

const getRuntimeClass = (topic: string): CockpitRuntimeClass =>
  topic === 'deployment-runtime' ? 'deployed-service' : 'local-service';

const createEntry = (
  product: CockpitProduct,
  section: CockpitManifestEntry['section'],
  topic: string
): CockpitManifestEntry => {
  const isDocsOnly = section === 'getting-started';
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
    entryKind: isDocsOnly ? 'docs-only' : 'capability',
    runtimeClass: isDocsOnly ? 'docs-only' : getRuntimeClass(topic),
    docsPath: getDocsPath(product, section, topic),
    promptAssetPaths: isDocsOnly ? [] : [getPromptAssetPath(product, topic)],
    codeAssetPaths: isDocsOnly ? [] : [getCodeAssetPath(product, topic)],
    implementationStatus: isDocsOnly ? 'docs-authored' : 'implemented',
    docsStatus: 'docs-authored',
    testStatus: isDocsOnly ? 'docs-authored' : 'smoke-tested',
    deploymentStatus: 'planned',
    testingContract: {
      smokeTarget: isDocsOnly ? null : getSmokeTarget(product, topic),
      integrationTarget: isDocsOnly ? null : getIntegrationTarget(product, topic),
      integrationMode:
        isDocsOnly || getIntegrationTarget(product, topic) === null
          ? 'none'
          : 'secret-gated',
      deploySmokePath: `/${product}/${section}/${topic}/${page}/python`,
    },
  };
};

export const cockpitManifest: CockpitManifestEntry[] = Object.entries(
  APPROVED_TOPICS
).flatMap(([product, sections]) =>
  Object.entries(sections).flatMap(([section, topics]) =>
    (topics as readonly string[]).map((topic: string) =>
      createEntry(
        product as CockpitProduct,
        section as CockpitManifestEntry['section'],
        topic
      )
    )
  )
);
