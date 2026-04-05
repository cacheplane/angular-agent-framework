/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ModeSwitcher } from './mode-switcher';

const MODES = ['Run', 'Code'] as const;

function ModeSwitcherHarness() {
  const [activeMode, setActiveMode] = useState<(typeof MODES)[number]>('Run');

  return (
    <div>
      <ModeSwitcher
        modes={MODES}
        activeMode={activeMode}
        onChange={setActiveMode}
      />
      <section aria-label="Visible mode content">{activeMode} content</section>
    </div>
  );
}

describe('ModeSwitcher', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
  });

  it('shows mode buttons with Run active by default', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root.render(<ModeSwitcherHarness />);
    });

    const buttons = Array.from(container.querySelectorAll('[data-mode-btn]'));

    expect(buttons.map((b) => b.textContent)).toEqual(['Run', 'Code']);
    expect(container.textContent).toContain('Run content');
  });

  it('updates visible content when another mode is clicked', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root.render(<ModeSwitcherHarness />);
    });

    const codeButton = Array.from(container.querySelectorAll('[data-mode-btn]')).find(
      (b) => b.textContent === 'Code'
    );

    expect(codeButton).toBeDefined();

    act(() => {
      (codeButton as HTMLElement).click();
    });

    expect(container.textContent).toContain('Code content');
    expect(container.textContent).not.toContain('Run content');
  });
});
