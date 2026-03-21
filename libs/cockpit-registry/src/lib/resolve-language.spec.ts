import { describe, expect, it } from 'vitest';
import { cockpitManifest } from './manifest';
import type { CockpitManifestEntry } from './manifest.types';
import { resolveManifestLanguage } from './resolve-language';

const streamingPythonEntry = cockpitManifest.find(
  (entry) =>
    entry.product === 'langgraph' &&
    entry.section === 'core-capabilities' &&
    entry.topic === 'streaming' &&
    entry.language === 'python'
);

describe('resolveManifestLanguage', () => {
  it('returns the equivalent page in the requested language when it exists', () => {
    const manifest: CockpitManifestEntry[] = [
      {
        ...(streamingPythonEntry as CockpitManifestEntry),
        supportedLanguages: ['python', 'typescript'],
        equivalentPages: {
          python: {
            product: 'langgraph',
            section: 'core-capabilities',
            topic: 'streaming',
            page: 'overview',
            language: 'python',
          },
          typescript: {
            product: 'langgraph',
            section: 'core-capabilities',
            topic: 'streaming',
            page: 'overview',
            language: 'typescript',
          },
        },
      },
      {
        ...(streamingPythonEntry as CockpitManifestEntry),
        language: 'typescript',
        supportedLanguages: ['python', 'typescript'],
        equivalentPages: {
          python: {
            product: 'langgraph',
            section: 'core-capabilities',
            topic: 'streaming',
            page: 'overview',
            language: 'python',
          },
          typescript: {
            product: 'langgraph',
            section: 'core-capabilities',
            topic: 'streaming',
            page: 'overview',
            language: 'typescript',
          },
        },
        fallbackTarget: {
          product: 'langgraph',
          section: 'getting-started',
          topic: 'overview',
          page: 'overview',
          language: 'python',
        },
      },
    ];

    expect(
      resolveManifestLanguage({
        manifest,
        entry: manifest[0],
        language: 'typescript',
      })
    ).toMatchObject({
      product: 'langgraph',
      topic: 'streaming',
      language: 'typescript',
    });
  });

  it('falls back to the product getting-started overview when no equivalent exists', () => {
    expect(
      resolveManifestLanguage({
        manifest: cockpitManifest,
        entry: streamingPythonEntry as CockpitManifestEntry,
        language: 'typescript',
      })
    ).toMatchObject({
      product: 'langgraph',
      section: 'getting-started',
      topic: 'overview',
      language: 'python',
    });
  });
});
