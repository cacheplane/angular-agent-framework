import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CodePane } from './code-pane/code-pane';
import { DocsPane } from './docs-pane/docs-pane';
import { PromptPane } from './prompt-pane/prompt-pane';

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
