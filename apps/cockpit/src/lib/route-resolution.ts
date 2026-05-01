import {
  resolveManifestLanguage,
  type CockpitLanguage,
  type CockpitManifestEntry,
} from '@ngaf/cockpit-registry';
import { langgraphStreamingPythonModule } from '../../../../cockpit/langgraph/streaming/python/src/index';
import { langgraphPersistencePythonModule } from '../../../../cockpit/langgraph/persistence/python/src/index';
import { langgraphInterruptsPythonModule } from '../../../../cockpit/langgraph/interrupts/python/src/index';
import { langgraphMemoryPythonModule } from '../../../../cockpit/langgraph/memory/python/src/index';
import { langgraphDurableExecutionPythonModule } from '../../../../cockpit/langgraph/durable-execution/python/src/index';
import { langgraphSubgraphsPythonModule } from '../../../../cockpit/langgraph/subgraphs/python/src/index';
import { langgraphTimeTravelPythonModule } from '../../../../cockpit/langgraph/time-travel/python/src/index';
import { langgraphDeploymentRuntimePythonModule } from '../../../../cockpit/langgraph/deployment-runtime/python/src/index';
import { deepAgentsMemoryPythonModule } from '../../../../cockpit/deep-agents/memory/python/src/index';
import { deepAgentsPlanningPythonModule } from '../../../../cockpit/deep-agents/planning/python/src/index';
import { deepAgentsFilesystemPythonModule } from '../../../../cockpit/deep-agents/filesystem/python/src/index';
import { deepAgentsSubagentsPythonModule } from '../../../../cockpit/deep-agents/subagents/python/src/index';
import { deepAgentsSkillsPythonModule } from '../../../../cockpit/deep-agents/skills/python/src/index';
import { deepAgentsSandboxesPythonModule } from '../../../../cockpit/deep-agents/sandboxes/python/src/index';
import { renderSpecRenderingPythonModule } from '../../../../cockpit/render/spec-rendering/python/src/index';
import { renderElementRenderingPythonModule } from '../../../../cockpit/render/element-rendering/python/src/index';
import { renderStateManagementPythonModule } from '../../../../cockpit/render/state-management/python/src/index';
import { renderRegistryPythonModule } from '../../../../cockpit/render/registry/python/src/index';
import { renderRepeatLoopsPythonModule } from '../../../../cockpit/render/repeat-loops/python/src/index';
import { renderComputedFunctionsPythonModule } from '../../../../cockpit/render/computed-functions/python/src/index';
import { chatMessagesPythonModule } from '../../../../cockpit/chat/messages/python/src/index';
import { chatInputPythonModule } from '../../../../cockpit/chat/input/python/src/index';
import { chatInterruptsPythonModule } from '../../../../cockpit/chat/interrupts/python/src/index';
import { chatToolCallsPythonModule } from '../../../../cockpit/chat/tool-calls/python/src/index';
import { chatSubagentsPythonModule } from '../../../../cockpit/chat/subagents/python/src/index';
import { chatThreadsPythonModule } from '../../../../cockpit/chat/threads/python/src/index';
import { chatTimelinePythonModule } from '../../../../cockpit/chat/timeline/python/src/index';
import { chatGenerativeUiPythonModule } from '../../../../cockpit/chat/generative-ui/python/src/index';
import { chatDebugPythonModule } from '../../../../cockpit/chat/debug/python/src/index';
import { chatThemingPythonModule } from '../../../../cockpit/chat/theming/python/src/index';
import { chatA2uiPythonModule } from '../../../../cockpit/chat/a2ui/python/src/index';

export interface ResolveCockpitEntryOptions {
  manifest: CockpitManifestEntry[];
  product: CockpitManifestEntry['product'];
  section: CockpitManifestEntry['section'];
  topic: string;
  page: CockpitManifestEntry['page'];
  language: CockpitLanguage;
}

export interface NavigationSection {
  section: CockpitManifestEntry['section'];
  entries: CockpitManifestEntry[];
}

export interface NavigationProduct {
  product: CockpitManifestEntry['product'];
  sections: NavigationSection[];
}

export type CapabilityPresentation =
  | {
      kind: 'docs-only';
      entry: CockpitManifestEntry;
      docsPath: string;
    }
  | {
      kind: 'capability';
      entry: CockpitManifestEntry;
      docsPath: string;
      promptAssetPaths: string[];
      codeAssetPaths: string[];
      backendAssetPaths: string[];
      docsAssetPaths: string[];
      runtimeUrl?: string;
      devPort?: number;
    };

const capabilityModules = [
  langgraphStreamingPythonModule,
  langgraphPersistencePythonModule,
  langgraphInterruptsPythonModule,
  langgraphMemoryPythonModule,
  langgraphDurableExecutionPythonModule,
  langgraphSubgraphsPythonModule,
  langgraphTimeTravelPythonModule,
  langgraphDeploymentRuntimePythonModule,
  deepAgentsMemoryPythonModule,
  deepAgentsPlanningPythonModule,
  deepAgentsFilesystemPythonModule,
  deepAgentsSubagentsPythonModule,
  deepAgentsSkillsPythonModule,
  deepAgentsSandboxesPythonModule,
  renderSpecRenderingPythonModule,
  renderElementRenderingPythonModule,
  renderStateManagementPythonModule,
  renderRegistryPythonModule,
  renderRepeatLoopsPythonModule,
  renderComputedFunctionsPythonModule,
  chatMessagesPythonModule,
  chatInputPythonModule,
  chatInterruptsPythonModule,
  chatToolCallsPythonModule,
  chatSubagentsPythonModule,
  chatThreadsPythonModule,
  chatTimelinePythonModule,
  chatGenerativeUiPythonModule,
  chatDebugPythonModule,
  chatThemingPythonModule,
  chatA2uiPythonModule,
];

export const toCockpitPath = (entry: CockpitManifestEntry): string =>
  `/${entry.product}/${entry.section}/${entry.topic}/${entry.page}/${entry.language}`;

export const resolveCockpitEntry = ({
  manifest,
  product,
  section,
  topic,
  page,
  language,
}: ResolveCockpitEntryOptions): CockpitManifestEntry => {
  const exactEntry = manifest.find(
    (entry) =>
      entry.product === product &&
      entry.section === section &&
      entry.topic === topic &&
      entry.page === page &&
      entry.language === language
  );

  if (exactEntry) {
    return exactEntry;
  }

  const canonicalEntry = manifest.find(
    (entry) =>
      entry.product === product &&
      entry.section === section &&
      entry.topic === topic &&
      entry.page === page
  );

  if (canonicalEntry) {
    return resolveManifestLanguage({
      manifest,
      entry: canonicalEntry,
      language,
    });
  }

  const fallbackOverview = manifest.find(
    (entry) =>
      entry.product === product &&
      entry.section === 'getting-started' &&
      entry.topic === 'overview' &&
      entry.page === 'overview' &&
      entry.language === 'python'
  );

  if (!fallbackOverview) {
    throw new Error(`No manifest entry found for ${product}/${section}/${topic}/${page}`);
  }

  return resolveManifestLanguage({
    manifest,
    entry: fallbackOverview,
    language,
  });
};

export const buildNavigationTree = (
  manifest: CockpitManifestEntry[]
): NavigationProduct[] => {
  const products: CockpitManifestEntry['product'][] = ['deep-agents', 'langgraph', 'render', 'chat'];
  const sections: CockpitManifestEntry['section'][] = [
    'getting-started',
    'core-capabilities',
  ];
  const uniqueEntries = manifest.filter(
    (entry, index, entries) =>
      entries.findIndex(
        (candidate) =>
          candidate.product === entry.product &&
          candidate.section === entry.section &&
          candidate.topic === entry.topic &&
          candidate.page === entry.page
      ) === index
  );

  return products.map((product) => ({
    product,
    sections: sections.map((section) => ({
      section,
      entries: uniqueEntries.filter(
        (entry) => entry.product === product && entry.section === section
      ),
    })),
  }));
};

export const getCapabilityPresentation = (
  entry: CockpitManifestEntry
): CapabilityPresentation => {
  if (entry.entryKind === 'docs-only') {
    return {
      kind: 'docs-only',
      entry,
      docsPath: entry.docsPath,
    };
  }

  const module = capabilityModules.find(
    (candidate) =>
      candidate.manifestIdentity.product === entry.product &&
      candidate.manifestIdentity.section === entry.section &&
      candidate.manifestIdentity.topic === entry.topic &&
      candidate.manifestIdentity.page === entry.page &&
      candidate.manifestIdentity.language === entry.language
  );

  return {
    kind: 'capability',
    entry,
    docsPath: module?.docsPath ?? entry.docsPath,
    promptAssetPaths: module?.promptAssetPaths ?? entry.promptAssetPaths,
    codeAssetPaths: module?.codeAssetPaths ?? entry.codeAssetPaths,
    backendAssetPaths: module?.backendAssetPaths ?? [],
    docsAssetPaths: module?.docsAssetPaths ?? [],
    runtimeUrl: module?.runtimeUrl,
    devPort: module?.devPort,
  };
};
