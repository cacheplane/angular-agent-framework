/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/analytics/client', () => ({ track: vi.fn() }));

import { track } from '../../lib/analytics/client';
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

  describe('copy tracking', () => {
    let container: HTMLDivElement | undefined;
    let root: ReturnType<typeof createRoot> | undefined;

    afterEach(() => {
      act(() => {
        root?.unmount();
      });
      container?.remove();
      vi.clearAllMocks();
    });

    function renderWith(html: string) {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);

      Object.assign(navigator, {
        clipboard: { writeText: vi.fn(() => Promise.resolve()) },
      });

      act(() => {
        root!.render(
          <NarrativeDocs
            narrativeDocs={[{ title: 'Doc', html, sourceFile: 'doc.md' }]}
            capability="streaming"
          />,
        );
      });
    }

    it('fires cockpit:code_copied with surface=docs_code_snippet on code copy click', () => {
      renderWith(
        '<div class="doc-codeblock"><button data-copy-code>Copy</button><pre><code>const x = 1;</code></pre></div>',
      );
      const btn = container!.querySelector('[data-copy-code]') as HTMLElement;
      act(() => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      expect(track).toHaveBeenCalledWith('cockpit:code_copied', {
        capability: 'streaming',
        surface: 'docs_code_snippet',
      });
    });

    it('fires cockpit:code_copied with surface=agentic_prompt on prompt copy click', () => {
      renderWith(
        '<div class="doc-prompt"><button data-copy-prompt>Copy prompt</button><div class="doc-prompt__content">You are helpful.</div></div>',
      );
      const btn = container!.querySelector('[data-copy-prompt]') as HTMLElement;
      act(() => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      expect(track).toHaveBeenCalledWith('cockpit:code_copied', {
        capability: 'streaming',
        surface: 'agentic_prompt',
      });
    });
  });
});
