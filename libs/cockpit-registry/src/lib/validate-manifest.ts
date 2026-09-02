import type {
  CockpitManifestEntry,
  CockpitManifestIdentity,
} from './manifest.types';
import { PRIMARY_CAPABILITY_BY_DOCS_PATH } from './workspace-resolution';

const identityKey = ({
  product,
  section,
  topic,
  page,
  language,
}: CockpitManifestIdentity): string =>
  `${product}/${section}/${topic}/${page}/${language}`;

export interface ValidateManifestOptions {
  primaryDocsMappings?: Readonly<Record<string, string>>;
}

export const validateManifest = (
  manifest: readonly CockpitManifestEntry[],
  options: ValidateManifestOptions = {}
): string[] => {
  const errors: string[] = [];
  const identities = new Set<string>();
  const stableIds = new Set<string>();
  const workspacePaths = new Set<string>();
  const legacyPaths = new Set<string>();
  const primaryDocsMappings =
    options.primaryDocsMappings ?? PRIMARY_CAPABILITY_BY_DOCS_PATH;

  for (const entry of manifest) {
    const key = identityKey(entry);
    const expectedId = `${entry.product}:${entry.section}:${entry.topic}:${entry.page}:${entry.language}`;

    if (identities.has(key)) {
      errors.push(`Duplicate canonical identity: ${key}`);
    } else {
      identities.add(key);
    }

    if (entry.id !== expectedId) {
      errors.push(
        `Invalid stable ID for ${key}: ${entry.id}; expected ${expectedId}`
      );
    }

    if (stableIds.has(entry.id)) {
      errors.push(`Duplicate stable ID: ${entry.id}`);
    } else {
      stableIds.add(entry.id);
    }

    if (workspacePaths.has(entry.workspacePath)) {
      errors.push(`Duplicate workspace path: ${entry.workspacePath}`);
    } else {
      workspacePaths.add(entry.workspacePath);
    }

    if (legacyPaths.has(entry.legacyPath)) {
      errors.push(`Duplicate legacy path: ${entry.legacyPath}`);
    } else {
      legacyPaths.add(entry.legacyPath);
    }
  }

  const docsPathEntries = new Map<string, CockpitManifestEntry[]>();
  for (const entry of manifest) {
    if (entry.docsPath) {
      const entries = docsPathEntries.get(entry.docsPath) ?? [];
      entries.push(entry);
      docsPathEntries.set(entry.docsPath, entries);
    }
  }

  for (const [docsPath, entries] of docsPathEntries) {
    if (entries.length < 2) continue;
    const primaryId = primaryDocsMappings[docsPath];
    if (!primaryId || !entries.some((entry) => entry.id === primaryId)) {
      errors.push(
        `Ambiguous Docs path without an explicit primary capability: ${docsPath}`
      );
    }
  }

  for (const entry of manifest) {
    if (
      entry.docsPath &&
      !/^\/docs\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(entry.docsPath)
    ) {
      errors.push(`Invalid docsPath for ${entry.id}: ${entry.docsPath}`);
    }

    const expectedWorkspacePath = `/workspace/${entry.product}/${entry.topic}`;
    if (entry.workspacePath !== expectedWorkspacePath) {
      errors.push(
        `Invalid workspacePath for ${entry.id}: ${entry.workspacePath}`
      );
    }

    const expectedLegacyPath = `/${entry.product}/${entry.section}/${entry.topic}/${entry.page}/${entry.language}`;
    if (entry.legacyPath !== expectedLegacyPath) {
      errors.push(`Invalid legacyPath for ${entry.id}: ${entry.legacyPath}`);
    }
  }

  for (const entry of manifest) {
    const targetKey = identityKey(entry.fallbackTarget);

    if (!identities.has(targetKey)) {
      errors.push(
        `Invalid fallback target for ${identityKey(entry)}: ${targetKey}`
      );
    }
  }

  for (const entry of manifest) {
    if (!entry.testingContract) {
      errors.push(`Missing testing contract for ${identityKey(entry)}`);
      continue;
    }

    if (
      entry.entryKind === 'capability' &&
      !entry.testingContract.smokeTarget
    ) {
      errors.push(`Missing smoke target for ${identityKey(entry)}`);
    }

    if (!entry.testingContract.deploySmokePath.startsWith('/')) {
      errors.push(`Invalid deploy smoke path for ${identityKey(entry)}`);
    }

    if (
      entry.testingContract.integrationMode !== 'none' &&
      !entry.testingContract.integrationTarget
    ) {
      errors.push(`Missing integration target for ${identityKey(entry)}`);
    }
  }

  return errors;
};

export const validateCockpitManifest = (
  manifest: CockpitManifestEntry[]
): string[] => validateManifest(manifest);
