/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeMode } from './code-mode';

describe('CodeMode', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
  });

  it('renders Shiki-highlighted HTML for the active file', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const codeFiles: Record<string, string> = {
      'apps/cockpit/src/app/page.tsx': '<pre class="shiki"><code>export default function Page() {}</code></pre>',
      'cockpit/langgraph/streaming/python/src/index.ts': '<pre class="shiki"><code>const x = 1;</code></pre>',
    };

    act(() => {
      root!.render(
        <CodeMode
          entryTitle="LangGraph Streaming"
          codeAssetPaths={[
            'apps/cockpit/src/app/page.tsx',
            'cockpit/langgraph/streaming/python/src/index.ts',
          ]}
          backendAssetPaths={[]}
          codeFiles={codeFiles}
          promptFiles={{}}
        />
      );
    });

    expect(container.querySelector('.shiki')).not.toBeNull();
    expect(container.textContent).toContain('export default function Page() {}');

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent)).toEqual(['page.tsx', 'index.ts']);

    act(() => {
      (tabs[1] as HTMLElement).dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })
      );
    });

    expect(container.textContent).toContain('const x = 1;');
  });

  it('renders a fallback message when codeFiles has no entry for a path', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <CodeMode
          entryTitle="Test"
          codeAssetPaths={['missing/file.ts']}
          backendAssetPaths={[]}
          codeFiles={{}}
          promptFiles={{}}
        />
      );
    });

    expect(container.textContent).toContain('No source available');
  });

  it('renders prompt files as tabs after a separator', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const promptFiles: Record<string, string> = {
      'prompts/system.md': 'You are a helpful assistant.',
    };

    act(() => {
      root!.render(
        <CodeMode
          entryTitle="Test Entry"
          codeAssetPaths={['src/app.tsx']}
          backendAssetPaths={[]}
          codeFiles={{ 'src/app.tsx': '<pre class="shiki"><code>const app = true;</code></pre>' }}
          promptFiles={promptFiles}
        />
      );
    });

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    const tabLabels = tabs.map((tab) => tab.textContent);
    expect(tabLabels).toContain('app.tsx');
    expect(tabLabels).toContain('system.md');

    act(() => {
      const promptTab = tabs.find((tab) => tab.textContent === 'system.md') as HTMLElement;
      promptTab.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })
      );
    });

    expect(container.textContent).toContain('You are a helpful assistant.');
  });
});
