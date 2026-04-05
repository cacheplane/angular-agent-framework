import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CodeMode } from './code-mode/code-mode';
import { CodePane } from './code-pane/code-pane';
import { CockpitShell } from './cockpit-shell';

import { getCockpitPageModel } from '../lib/cockpit-page';

describe('metadata-driven panes', () => {
  it('renders code pane from metadata values', () => {
    const html = renderToStaticMarkup(
      <div>
        <CodePane paths={['cockpit/langgraph/streaming/python/src/index.ts']} />
      </div>
    );

    expect(html).toContain('cockpit/langgraph/streaming/python/src/index.ts');
  });
});

describe('cockpit shell contract', () => {
  it('renders a simplified shell with sidebar, run/code modes, and compact header', () => {
    const model = getCockpitPageModel();
    const html = renderToStaticMarkup(
      <CockpitShell
        navigationTree={model.navigationTree}
        presentation={model.presentation}
        entryTitle={model.entry.title}
        contentBundle={{ codeFiles: {}, promptFiles: {}, runtimeUrl: null, docSections: [], narrativeDocs: [] }}
      />
    );

    expect(html).toContain('Cockpit');
    expect(html).toContain('Deep Agents');
    expect(html).toContain('LangGraph');
    expect(html).toContain('Run');
    expect(html).toContain('Code');
    expect(html).toContain('Docs');
    expect(html).not.toContain('Explore the example surface');
    expect(html).not.toContain('Run example');
    expect(html).not.toContain('Open prompt assets');
    expect(html).not.toContain('aria-label="Prompt drawer"');
  });
});

describe('refreshed shell structure', () => {
  it('renders the key structure for the full-height shell and file tabs', () => {
    const model = getCockpitPageModel();
    const html = renderToStaticMarkup(
      <div>
        <CockpitShell
          navigationTree={model.navigationTree}
          presentation={model.presentation}
          entryTitle={model.entry.title}
          contentBundle={{ codeFiles: {}, promptFiles: {}, runtimeUrl: null, docSections: [], narrativeDocs: [] }}
        />
        <CodeMode
          entryTitle="LangGraph Streaming"
          codeAssetPaths={[
            'apps/cockpit/src/app/page.tsx',
            'cockpit/langgraph/streaming/python/src/index.ts',
          ]}
          backendAssetPaths={[]}
          codeFiles={{}}
          promptFiles={{}}
        />
      </div>
    );

    expect(html).toContain('aria-label="Cockpit shell"');
    expect(html).toContain('aria-label="Cockpit sidebar"');
    expect(html).toContain('aria-label="Code mode"');
    expect(html).toContain('page.tsx');
    expect(html).toContain('index.ts');
  });
});
