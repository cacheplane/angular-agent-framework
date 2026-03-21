import type {
  CockpitLanguage,
  CockpitManifestEntry,
  CockpitManifestIdentity,
} from './manifest.types';

export interface ResolveManifestLanguageOptions {
  manifest: CockpitManifestEntry[];
  entry: CockpitManifestEntry;
  language: CockpitLanguage;
}

const matchesIdentity = (
  entry: CockpitManifestEntry,
  identity: CockpitManifestIdentity
): boolean =>
  entry.product === identity.product &&
  entry.section === identity.section &&
  entry.topic === identity.topic &&
  entry.page === identity.page &&
  entry.language === identity.language;

export const resolveManifestLanguage = ({
  manifest,
  entry,
  language,
}: ResolveManifestLanguageOptions): CockpitManifestEntry => {
  const equivalentIdentity = entry.equivalentPages[language];

  if (equivalentIdentity) {
    const equivalentEntry = manifest.find((candidate) =>
      matchesIdentity(candidate, equivalentIdentity)
    );

    if (equivalentEntry) {
      return equivalentEntry;
    }
  }

  const languageSpecificOverview = manifest.find(
    (candidate) =>
      candidate.product === entry.product &&
      candidate.section === 'getting-started' &&
      candidate.topic === 'overview' &&
      candidate.page === 'overview' &&
      candidate.language === language
  );

  if (languageSpecificOverview) {
    return languageSpecificOverview;
  }

  const pythonOverview = manifest.find(
    (candidate) =>
      candidate.product === entry.product &&
      candidate.section === 'getting-started' &&
      candidate.topic === 'overview' &&
      candidate.page === 'overview' &&
      candidate.language === 'python'
  );

  if (!pythonOverview) {
    throw new Error(`Missing python overview for product ${entry.product}`);
  }

  return pythonOverview;
};
