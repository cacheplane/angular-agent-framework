import { getCockpitDocsPath } from './docs-links';
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
      'client-tools',
    ],
  },
  'ag-ui': {
    'getting-started': ['overview'],
    'core-capabilities': [
      'streaming',
      'interrupts',
      'tool-views',
      'json-render',
      'client-tools',
      'a2ui',
      'subagents',
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
      'a2ui',
    ],
  },
  runtimes: {
    'getting-started': ['overview'],
    'core-capabilities': [
      'microsoft-agent-framework',
      'aws-strands',
      'mastra',
    ],
  },
} as const;

/**
 * Example-directory lane for a capability topic, as `<product>/<topic>`.
 * Every topic ships its example under `cockpit/<product>/<topic>/python`
 * except the ones listed here: the Mastra runtime's backend is the Node
 * AG-UI service `deployments/ag-ui-mastra`, so its assets and smoke target
 * live in the `angular` lane instead. Keeping the lane explicit is what
 * keeps `promptAssetPaths`/`codeAssetPaths` pointing at files that exist.
 */
const TOPIC_LANES: Record<string, 'python' | 'angular'> = {
  'runtimes/mastra': 'angular',
};

const getLane = (product: string, topic: string): 'python' | 'angular' =>
  TOPIC_LANES[`${product}/${topic}`] ?? 'python';

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
    case 'ag-ui':
      return 'AG-UI';
    case 'render':
      return 'Render';
    case 'chat':
      return 'Chat';
    case 'runtimes':
      return 'Runtimes';
  }
};

const getOverviewIdentity = (product: CockpitProduct): CockpitManifestIdentity => ({
  product,
  section: 'getting-started',
  topic: 'overview',
  page: 'overview',
  language: 'python',
});

/**
 * The website documentation page for a capability.
 *
 * This is a table lookup, not a formula: the cockpit tree and the docs tree do
 * not share a naming scheme. See `./docs-links.ts`. Returns the empty string
 * for capabilities with no published page.
 */
const getDocsPath = (
  product: CockpitProduct,
  section: CockpitManifestEntry['section'],
  topic: string
): string => getCockpitDocsPath(product, section, topic);

const getPromptAssetPath = (product: CockpitProduct, topic: string): string =>
  `cockpit/${product}/${topic}/${getLane(product, topic)}/prompts/${topic}.md`;

const getCodeAssetPath = (product: CockpitProduct, topic: string): string =>
  `cockpit/${product}/${topic}/${getLane(product, topic)}/src/index.ts`;

const getSmokeTarget = (product: CockpitProduct, topic: string): string =>
  `cockpit-${product}-${topic}-${getLane(product, topic)}:smoke`;

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
      integrationTarget: null,
      integrationMode: 'none',
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
