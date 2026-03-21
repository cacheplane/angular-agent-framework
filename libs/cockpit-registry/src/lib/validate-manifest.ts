import type { CockpitManifestEntry, CockpitManifestIdentity } from './manifest.types';

const identityKey = ({
  product,
  section,
  topic,
  page,
  language,
}: CockpitManifestIdentity): string =>
  `${product}/${section}/${topic}/${page}/${language}`;

export const validateCockpitManifest = (manifest: CockpitManifestEntry[]): string[] => {
  const errors: string[] = [];
  const identities = new Set<string>();

  for (const entry of manifest) {
    const key = identityKey(entry);

    if (identities.has(key)) {
      errors.push(`Duplicate canonical identity: ${key}`);
    } else {
      identities.add(key);
    }
  }

  for (const entry of manifest) {
    const targetKey = identityKey(entry.fallbackTarget);

    if (!identities.has(targetKey)) {
      errors.push(`Invalid fallback target for ${identityKey(entry)}: ${targetKey}`);
    }
  }

  return errors;
};

