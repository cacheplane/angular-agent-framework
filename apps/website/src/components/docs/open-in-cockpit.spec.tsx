import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveDocsBundle } from '@cacheplane/cockpit-docs';
import { OpenInCockpit } from './open-in-cockpit';

describe('OpenInCockpit', () => {
  it('renders a metadata-driven cockpit link for the current docs bundle', () => {
    const bundle = resolveDocsBundle({
      product: 'deep-agents',
      section: 'core-capabilities',
      topic: 'planning',
      page: 'overview',
      language: 'python',
    });

    const html = renderToStaticMarkup(<OpenInCockpit bundle={bundle} />);

    expect(html).toContain('/deep-agents/core-capabilities/planning/overview/python');
  });
});
