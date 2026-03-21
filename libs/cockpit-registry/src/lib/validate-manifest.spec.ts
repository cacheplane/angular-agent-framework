import { describe, expect, it } from 'vitest';
import { cockpitManifest } from './manifest';
import { validateCockpitManifest } from './validate-manifest';
import type { CockpitManifestEntry } from './manifest.types';

describe('validateCockpitManifest', () => {
  it('rejects duplicate canonical identities', () => {
    const duplicateManifest: CockpitManifestEntry[] = [
      cockpitManifest[0],
      {
        ...cockpitManifest[0],
        title: 'Duplicate entry',
      },
    ];

    expect(validateCockpitManifest(duplicateManifest)).toEqual([
      'Duplicate canonical identity: deep-agents/getting-started/overview/overview/python',
    ]);
  });

  it('rejects fallback targets that do not exist in the manifest', () => {
    const invalidFallbackManifest: CockpitManifestEntry[] = [
      {
        ...cockpitManifest[0],
        fallbackTarget: {
          product: 'langgraph',
          section: 'core-capabilities',
          topic: 'missing-target',
          page: 'overview',
          language: 'typescript',
        },
      },
    ];

    expect(validateCockpitManifest(invalidFallbackManifest)).toEqual([
      'Invalid fallback target for deep-agents/getting-started/overview/overview/python: langgraph/core-capabilities/missing-target/overview/typescript',
    ]);
  });
});
