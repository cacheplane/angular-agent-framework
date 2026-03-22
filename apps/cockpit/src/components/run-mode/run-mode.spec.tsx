import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunMode } from './run-mode';

describe('RunMode', () => {
  it('renders the live example surface and supporting implementation context', () => {
    const html = renderToStaticMarkup(
      <RunMode
        entryTitle="LangGraph Streaming"
        docsPath="/docs/langgraph/core-capabilities/streaming/overview/python"
        codeAssetPaths={[
          'apps/cockpit/src/app/page.tsx',
          'cockpit/langgraph/streaming/python/src/index.ts',
        ]}
      />
    );

    expect(html).toContain('Interactive example');
    expect(html).toContain('LangGraph Streaming');
    expect(html).toContain('/docs/langgraph/core-capabilities/streaming/overview/python');
    expect(html).toContain('apps/cockpit/src/app/page.tsx');
    expect(html).toContain('cockpit/langgraph/streaming/python/src/index.ts');
  });
});
