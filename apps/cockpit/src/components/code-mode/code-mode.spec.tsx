/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeMode } from './code-mode';

describe('CodeMode', () => {
  afterEach(() => {
    globalThis.document?.body.replaceChildren();
  });

  it('renders file tabs across the top with a single active file and no side file column', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const { window } = dom;

    globalThis.window = window as unknown as Window & typeof globalThis;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.MouseEvent = window.MouseEvent;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <CodeMode
          entryTitle="LangGraph Streaming"
          codeAssetPaths={[
            'apps/cockpit/src/app/page.tsx',
            'cockpit/langgraph/streaming/python/src/index.ts',
          ]}
        />
      );
    });

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));

    expect(container.querySelector('[aria-label="File column"]')).toBeNull();
    expect(container.textContent).toContain('apps/cockpit/src/app/page.tsx');
    expect(container.textContent).not.toContain(
      'cockpit/langgraph/streaming/python/src/index.ts'
    );
    expect(tabs.map((tab) => tab.textContent)).toEqual(['page.tsx', 'index.ts']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    act(() => {
      (tabs[1] as HTMLElement).click();
    });

    expect(container.textContent).toContain(
      'cockpit/langgraph/streaming/python/src/index.ts'
    );
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(container.textContent).not.toContain('apps/cockpit/src/app/page.tsx');

    act(() => {
      root.unmount();
    });
  });
});
