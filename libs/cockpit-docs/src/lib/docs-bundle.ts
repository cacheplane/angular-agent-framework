import {
  cockpitManifest,
  type CockpitLanguage,
  type CockpitPageId,
  type CockpitProduct,
} from '@ngaf/cockpit-registry';

export interface DocsBundle {
  product: CockpitProduct;
  section: 'getting-started' | 'core-capabilities';
  topic: string;
  page: CockpitPageId;
  language: CockpitLanguage;
  title: string;
  sourcePath: string;
}

export interface ResolveDocsBundleOptions {
  product: CockpitProduct;
  section: DocsBundle['section'];
  topic: string;
  page: DocsBundle['page'];
  language: CockpitLanguage;
}

const PAGE_TITLE_SUFFIX = {
  overview: 'Overview',
  build: 'Build',
  prompts: 'Prompts',
  code: 'Code',
  testing: 'Testing',
} as const satisfies Record<CockpitPageId, string>;

const CAPABILITY_PAGES: CockpitPageId[] = [
  'overview',
  'build',
  'prompts',
  'code',
  'testing',
];

const docsBundles: DocsBundle[] = cockpitManifest.flatMap((entry) => {
  const pages =
    entry.entryKind === 'docs-only' ? (['overview'] as CockpitPageId[]) : CAPABILITY_PAGES;

  return pages.map((page) => ({
    product: entry.product,
    section: entry.section,
    topic: entry.topic,
    page,
    language: entry.language,
    title:
      entry.entryKind === 'docs-only'
        ? entry.title
        : `${entry.title} ${PAGE_TITLE_SUFFIX[page]}`,
    sourcePath: `${entry.product}/${entry.section}/${entry.topic}/${entry.language}/${page}.mdx`,
  }));
});

const findBundle = (options: ResolveDocsBundleOptions): DocsBundle | undefined =>
  docsBundles.find(
    (bundle) =>
      bundle.product === options.product &&
      bundle.section === options.section &&
      bundle.topic === options.topic &&
      bundle.page === options.page &&
      bundle.language === options.language
  );

export const resolveDocsBundle = (
  options: ResolveDocsBundleOptions
): DocsBundle => {
  const exactBundle = findBundle(options);

  if (exactBundle) {
    return exactBundle;
  }

  const matchingManifestEntry = cockpitManifest.find(
    (entry) =>
      entry.product === options.product &&
      entry.section === options.section &&
      entry.topic === options.topic
  );

  if (!matchingManifestEntry) {
    throw new Error(
      `No manifest entry for ${options.product}/${options.section}/${options.topic}`
    );
  }

  return findBundle({
    product: options.product,
    section: 'getting-started',
    topic: 'overview',
    page: 'overview',
    language: 'python',
  }) as DocsBundle;
};

export const toDocsSlug = (bundle: DocsBundle): string[] => [
  bundle.product,
  bundle.section,
  bundle.topic,
  bundle.page,
  bundle.language,
];

export const toCockpitHref = (bundle: DocsBundle): string =>
  `/${bundle.product}/${bundle.section}/${bundle.topic}/${bundle.page}/${bundle.language}`;

export const getDocsBundles = (): DocsBundle[] => docsBundles;
