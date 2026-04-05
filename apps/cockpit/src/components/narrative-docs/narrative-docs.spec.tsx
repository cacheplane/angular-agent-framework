import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NarrativeDocs } from './narrative-docs';

describe('NarrativeDocs', () => {
  it('renders narrative HTML content', () => {
    const html = renderToStaticMarkup(
      <NarrativeDocs
        narrativeDocs={[
          { title: 'Streaming Guide', html: '<h1>Streaming Guide</h1><p>Learn to stream.</p>', sourceFile: 'guide.md' },
        ]}
      />
    );
    expect(html).toContain('Streaming Guide');
    expect(html).toContain('Learn to stream.');
  });

  it('renders empty state when no docs', () => {
    const html = renderToStaticMarkup(<NarrativeDocs narrativeDocs={[]} />);
    expect(html).toContain('No documentation available');
  });
});
