import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { cockpitManifest } from '../../../../libs/cockpit-registry/src/index';
import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  it('links to an equivalent page when that language exists', () => {
    const manifest = [
      {
        ...cockpitManifest.find(
          (entry) =>
            entry.product === 'langgraph' &&
            entry.topic === 'streaming' &&
            entry.language === 'python'
        )!,
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
        ...cockpitManifest.find(
          (entry) =>
            entry.product === 'langgraph' &&
            entry.topic === 'streaming' &&
            entry.language === 'python'
        )!,
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
      },
    ];

    const html = renderToStaticMarkup(
      <LanguageSwitcher
        manifest={manifest}
        entry={manifest[0]}
      />
    );

    expect(html).toContain('/langgraph/core-capabilities/streaming/overview/typescript');
  });

  it('falls back to product overview when no equivalent page exists', () => {
    const html = renderToStaticMarkup(
      <LanguageSwitcher
        manifest={cockpitManifest}
        entry={cockpitManifest.find(
          (entry) =>
            entry.product === 'langgraph' &&
            entry.topic === 'streaming' &&
            entry.language === 'python'
        )!}
      />
    );

    expect(html).toContain('/langgraph/getting-started/overview/overview/python');
  });
});
