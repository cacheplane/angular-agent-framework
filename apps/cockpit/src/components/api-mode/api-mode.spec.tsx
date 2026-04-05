import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiMode } from './api-mode';

describe('ApiMode', () => {
  it('renders doc sections with signatures, descriptions, params, and returns', () => {
    const html = renderToStaticMarkup(
      <ApiMode
        docSections={[
          {
            title: 'StreamingComponent',
            signature: 'export class StreamingComponent',
            description: 'Renders a streaming chat UI.',
            params: [],
            returns: null,
            sourceFile: 'streaming.component.ts',
            language: 'typescript',
          },
          {
            title: 'stream',
            signature: 'stream(prompt: string): Observable<string>',
            description: 'Streams a response from the backend.',
            params: [{ name: 'prompt', description: 'The user message' }],
            returns: 'Observable emitting tokens',
            sourceFile: 'streaming.service.ts',
            language: 'typescript',
          },
          {
            title: 'StreamingGraph',
            signature: 'class StreamingGraph',
            description: 'Streams LLM responses.',
            params: [],
            returns: null,
            sourceFile: 'graph.py',
            language: 'python',
          },
        ]}
      />
    );

    expect(html).toContain('StreamingComponent');
    expect(html).toContain('export class StreamingComponent');
    expect(html).toContain('Renders a streaming chat UI.');
    expect(html).toContain('streaming.component.ts');

    expect(html).toContain('stream');
    expect(html).toContain('prompt');
    expect(html).toContain('The user message');
    expect(html).toContain('Observable emitting tokens');

    expect(html).toContain('StreamingGraph');
    expect(html).toContain('class StreamingGraph');
    expect(html).toContain('graph.py');

    expect(html).toContain('TypeScript');
    expect(html).toContain('Python');
  });

  it('renders empty state when no doc sections', () => {
    const html = renderToStaticMarkup(<ApiMode docSections={[]} />);
    expect(html).toContain('No API documentation extracted');
  });
});
