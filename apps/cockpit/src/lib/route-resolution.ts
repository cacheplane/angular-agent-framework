import {
  resolveManifestLanguage,
  type CockpitLanguage,
  type CockpitManifestEntry,
} from '../../../../libs/cockpit-registry/src/index';
import { langgraphStreamingPythonModule } from '../../../../cockpit/langgraph/streaming/python/src/index';

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
    };

const capabilityModules = [langgraphStreamingPythonModule];

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
  const products: CockpitManifestEntry['product'][] = ['deep-agents', 'langgraph'];
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
  };
};
