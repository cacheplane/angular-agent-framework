import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunMode } from './run-mode';

describe('RunMode', () => {
  it('renders an iframe when runtimeUrl is provided', () => {
    const html = renderToStaticMarkup(
      <RunMode entryTitle="LangGraph Streaming" runtimeUrl="http://localhost:4300" />
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('http://localhost:4300');
    expect(html).toContain('allow="clipboard-write"');
  });

  it('renders a minimal empty state when runtimeUrl is null', () => {
    const html = renderToStaticMarkup(
      <RunMode entryTitle="LangGraph Streaming" runtimeUrl={null} />
    );
    expect(html).not.toContain('<iframe');
    expect(html).toContain('No runtime available');
  });
});
