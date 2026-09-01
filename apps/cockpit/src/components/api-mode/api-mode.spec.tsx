import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    expect(html).toContain('<table');
    expect(html).toContain('Parameter');
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

  it('uses sentence-case sans typography for language and section headings while preserving code typography', () => {
    render(
      <ApiMode
        docSections={[
          {
            title: 'stream',
            signature: 'stream(prompt: string): Observable<string>',
            description: 'Streams `prompt` tokens.',
            params: [{ name: 'prompt', description: 'The user message' }],
            returns: 'An `Observable<string>`.',
            sourceFile: 'streaming.service.ts',
            language: 'typescript',
          },
        ]}
      />
    );

    for (const name of ['TypeScript', 'Parameters', 'Returns']) {
      const heading = screen.getByRole('heading', { name });
      expect(heading.className).not.toMatch(
        /(?:^|\s)(?:uppercase|tracking-wide|font-mono)(?:\s|$)/
      );
      expect(heading.className).toMatch(/(?:^|\s)font-sans(?:\s|$)/);
      expect(heading.className).toMatch(/(?:^|\s)tracking-normal(?:\s|$)/);
      expect(heading.className).toMatch(/(?:^|\s)cockpit-api-heading(?:\s|$)/);
    }

    expect(screen.getByRole('heading', { name: 'stream' }).className).toMatch(
      /(?:^|\s)font-mono(?:\s|$)/
    );
    expect(
      screen
        .getByText('stream(prompt: string): Observable<string>')
        .closest('pre')?.className
    ).toMatch(/(?:^|\s)font-mono(?:\s|$)/);
    for (const identifier of screen.getAllByText('prompt')) {
      expect(identifier.className).toMatch(/(?:^|\s)font-mono(?:\s|$)/);
    }

    const css = readFileSync(
      join(
        process.cwd().endsWith('/apps/cockpit')
          ? process.cwd()
          : join(process.cwd(), 'apps/cockpit'),
        'src/app/cockpit.css'
      ),
      'utf8'
    );
    expect(css).toMatch(
      /\.cockpit-prose \.cockpit-api-heading\s*\{[\s\S]*font-family:\s*var\(--font-inter\),\s*var\(--ds-font-sans\)[\s\S]*letter-spacing:\s*normal/
    );
  });
});
