import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CodeMode } from './code-mode/code-mode';
import { CodePane } from './code-pane/code-pane';
import { CockpitShell } from './cockpit-shell';
import { DocsPane } from './docs-pane/docs-pane';
import { PromptPane } from './prompt-pane/prompt-pane';
import { PromptDrawer } from './prompt-drawer/prompt-drawer';
import { getCockpitPageModel } from '../lib/cockpit-page';

describe('metadata-driven panes', () => {
  it('renders code, prompt, and docs panes from metadata values', () => {
    const html = renderToStaticMarkup(
      <div>
        <CodePane paths={['cockpit/langgraph/streaming/python/src/index.ts']} />
        <PromptPane paths={['cockpit/langgraph/streaming/python/prompts/streaming.md']} />
        <DocsPane path="/docs/langgraph/streaming" />
      </div>
    );

    expect(html).toContain('cockpit/langgraph/streaming/python/src/index.ts');
    expect(html).toContain('cockpit/langgraph/streaming/python/prompts/streaming.md');
    expect(html).toContain('/docs/langgraph/streaming');
  });
});

describe('cockpit shell contract', () => {
  it('renders a stable shell with a persistent sidebar, run-first modes, and no inline prompt pane by default', () => {
    const model = getCockpitPageModel();
    const html = renderToStaticMarkup(
      <CockpitShell
        navigationTree={model.navigationTree}
        presentation={model.presentation}
        entryTitle={model.entry.title}
      />
    );

    expect(html).toContain('Cockpit');
    expect(html).toContain('Explore the example surface');
    expect(html).toContain('Deep Agents');
    expect(html).toContain('LangGraph');
    expect(html).toContain('Run');
    expect(html).toContain('Code');
    expect(html).toContain('Docs');
    expect(html).toContain('Run example');
    expect(html).toContain('Open prompt assets');
    expect(html).toContain('Interactive example');
    expect(html).not.toContain('<h2>Prompts</h2>');
    expect(html).not.toContain('aria-label="Prompt drawer"');
  });
});

describe('refreshed shell structure', () => {
  it('renders the key class-based structure for the full-height shell, top file tabs, and prompt slide-over', () => {
    const model = getCockpitPageModel();
    const html = renderToStaticMarkup(
      <div>
        <CockpitShell
          navigationTree={model.navigationTree}
          presentation={model.presentation}
          entryTitle={model.entry.title}
        />
        <CodeMode
          entryTitle="LangGraph Streaming"
          codeAssetPaths={[
            'apps/cockpit/src/app/page.tsx',
            'cockpit/langgraph/streaming/python/src/index.ts',
          ]}
        />
        <PromptDrawer
          isOpen
          entryTitle="LangGraph Streaming"
          paths={['cockpit/langgraph/streaming/python/prompts/streaming.md']}
          onClose={() => undefined}
        />
      </div>
    );

    expect(html).toContain('cockpit-shell');
    expect(html).toContain('cockpit-shell__workspace');
    expect(html).toContain('cockpit-sidebar');
    expect(html).toContain('cockpit-code-mode__tabs');
    expect(html).toContain('cockpit-prompt-drawer');
  });
});
