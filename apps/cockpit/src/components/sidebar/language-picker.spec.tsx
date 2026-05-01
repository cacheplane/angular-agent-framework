import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { cockpitManifest } from '@ngaf/cockpit-registry';
import { LanguagePicker } from './language-picker';

describe('LanguagePicker', () => {
  afterEach(() => {
    globalThis.document?.body.replaceChildren();
  });

  it('shows the current language in the trigger and opens a custom menu', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const { window } = dom;

    globalThis.window = window as unknown as Window & typeof globalThis;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.MouseEvent = window.MouseEvent;

    const entry = cockpitManifest.find(
      (candidate) =>
        candidate.product === 'langgraph' &&
        candidate.section === 'core-capabilities' &&
        candidate.topic === 'streaming' &&
        candidate.language === 'python'
    )!;

    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);

    act(() => {
      root.render(<LanguagePicker entry={entry} manifest={cockpitManifest} />);
    });

    expect(container.querySelector('select')).toBeNull();
    expect(container.textContent).toContain('Python');

    const trigger = container.querySelector('button');
    expect(trigger).not.toBeNull();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    expect(container.textContent).toContain('TypeScript');

    act(() => {
      root.unmount();
    });
  });
});
