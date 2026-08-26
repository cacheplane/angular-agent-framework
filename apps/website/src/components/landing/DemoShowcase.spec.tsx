// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DemoShowcase } from './DemoShowcase';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({
  trackCtaClick: trackCtaClickMock,
  trackExternalLinkClick: vi.fn(),
  track: vi.fn(),
}));

vi.mock('../ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

/**
 * This section had no tests and an incomplete ARIA tabs pattern: it announced
 * `role="tablist"` while offering no `aria-controls`, no roving tabindex, and no
 * keyboard handling. These pin the behaviour the roles promise.
 */
describe('DemoShowcase', () => {
  it('offers a tab per runtime', () => {
    render(<DemoShowcase />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['LangGraph', 'AG-UI']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('pairs each tab with the panel it controls', () => {
    render(<DemoShowcase />);

    const tab = screen.getAllByRole('tab')[0];
    const panel = screen.getByRole('tabpanel');
    expect(tab.getAttribute('aria-controls')).toBe(panel.getAttribute('id'));
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.getAttribute('id'));
  });

  it('moves focus with the selection on arrow keys', () => {
    // The defect this section shipped with: selection moved, focus did not, so
    // the next Tab press skipped the tablist entirely.
    render(<DemoShowcase />);

    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });

    const tabs = screen.getAllByRole('tab');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[1]);
  });

  it('mounts only the active runtime clip', () => {
    // Two autoplaying videos in one section would fetch both on load.
    const { container } = render(<DemoShowcase />);

    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelector('source')?.getAttribute('src')).toMatch(/langgraph-demo/);
  });

  it('swaps the clip when the other runtime is selected', () => {
    const { container } = render(<DemoShowcase />);

    fireEvent.click(screen.getAllByRole('tab')[1]);

    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelector('source')?.getAttribute('src')).toMatch(/ag-ui-demo/);
  });

  it('reports the runtime whose demo was launched', () => {
    trackCtaClickMock.mockClear();
    render(<DemoShowcase />);

    fireEvent.click(screen.getAllByRole('tab')[1]);
    fireEvent.click(screen.getByRole('button', { name: /launch ag-ui live demo/i }));

    expect(trackCtaClickMock).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'home_demo', cta_id: 'home_demo_launch_ag_ui' }),
    );
  });
});
