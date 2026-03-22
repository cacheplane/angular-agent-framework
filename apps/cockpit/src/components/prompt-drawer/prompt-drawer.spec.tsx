/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CockpitShell } from '../cockpit-shell';
import { getCockpitPageModel } from '../../lib/cockpit-page';

describe('prompt drawer shell behavior', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
  });

  it('opens prompt assets in a secondary slide-over and preserves the active mode when it closes', () => {
    const model = getCockpitPageModel();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <CockpitShell
          navigationTree={model.navigationTree}
          presentation={model.presentation}
          entryTitle={model.entry.title}
        />
      );
    });

    const codeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Code'
    );

    act(() => {
      codeButton?.click();
    });

    expect(container.textContent).toContain('Code');
    expect(container.textContent).toContain('page.tsx');

    const openPromptButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Open prompt assets'
    );

    act(() => {
      openPromptButton?.click();
    });

    expect(container.querySelector('[aria-label="Prompt drawer"]')).not.toBeNull();
    expect(container.textContent).toContain('streaming.md');

    const closeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Close'
    );

    act(() => {
      closeButton?.click();
    });

    expect(container.querySelector('[aria-label="Prompt drawer"]')).toBeNull();
    expect(container.textContent).toContain('page.tsx');
  });
});
