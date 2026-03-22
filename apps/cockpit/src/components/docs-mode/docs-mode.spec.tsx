import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocsMode } from './docs-mode';

describe('DocsMode', () => {
  it('renders a documentation-style guide with title, body, code, and prompt copy affordances', () => {
    const html = renderToStaticMarkup(
      <DocsMode
        entryTitle="LangGraph Streaming"
        docsPath="/docs/langgraph/streaming"
        summary="Use the stream surface to inspect one runnable example end to end."
        sections={[
          {
            title: 'Start from the live surface',
            body: 'Run the example first, then move into the code view when you need implementation detail.',
            code: 'npm run cockpit -- --mode=run',
          },
        ]}
        promptCopy="Open prompt assets"
      />
    );

    expect(html).toContain('<h1>LangGraph Streaming</h1>');
    expect(html).toContain('Use the stream surface to inspect one runnable example end to end.');
    expect(html).toContain('<code>Run</code>');
    expect(html).toContain('<code>npm run cockpit -- --mode=run</code>');
    expect(html).toContain('Open prompt assets');
    expect(html).toContain('Start from the live surface');
  });
});
