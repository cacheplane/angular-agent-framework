import type {
  CockpitManifestEntry,
  CockpitManifestIdentity,
} from './manifest.types';

const identityKey = ({
  product,
  section,
  topic,
  page,
  language,
}: CockpitManifestIdentity): string =>
  `${product}/${section}/${topic}/${page}/${language}`;

export const validateManifest = (
  manifest: readonly CockpitManifestEntry[]
): string[] => {
  const errors: string[] = [];
  const identities = new Set<string>();
  const stableIds = new Set<string>();
  const workspacePaths = new Set<string>();
  const legacyPaths = new Set<string>();

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

  const docsPaths = new Set<string>();
  for (const entry of manifest) {
    if (!entry.docsPath) {
      errors.push(`Missing docsPath for ${entry.id}`);
      continue;
    }
    if (docsPaths.has(entry.docsPath)) {
      errors.push(`Duplicate Docs path: ${entry.docsPath}`);
    } else {
      docsPaths.add(entry.docsPath);
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
