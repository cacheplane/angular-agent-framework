// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: trackCtaClickMock, track: vi.fn() }));

beforeEach(() => trackCtaClickMock.mockClear());

describe('RuntimeParityToggle', () => {
  it('shows the LangGraph config pane by default and the pinned component pane', async () => {
    const { RuntimeParityToggle } = await import('./RuntimeParityToggle');
    render(
      <RuntimeParityToggle
        configPanes={{ langgraph: <pre>LG CONFIG</pre>, ag_ui: <pre>AGUI CONFIG</pre> }}
        componentPane={<pre>COMPONENT</pre>}
      />,
    );
    expect(screen.getByText('LG CONFIG')).toBeTruthy();
    expect(screen.queryByText('AGUI CONFIG')).toBeNull();
    expect(screen.getByText('COMPONENT')).toBeTruthy();
    expect(screen.getByText('same in both')).toBeTruthy();
  });

  it('switches to AG-UI and tracks the toggle with adapter', async () => {
    const { RuntimeParityToggle } = await import('./RuntimeParityToggle');
    render(
      <RuntimeParityToggle
        configPanes={{ langgraph: <pre>LG CONFIG</pre>, ag_ui: <pre>AGUI CONFIG</pre> }}
        componentPane={<pre>COMPONENT</pre>}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'AG-UI' }));
    expect(screen.getByText('AGUI CONFIG')).toBeTruthy();
    expect(screen.queryByText('LG CONFIG')).toBeNull();
    expect(screen.getByText('COMPONENT')).toBeTruthy();
    expect(trackCtaClickMock).toHaveBeenCalledWith(
      expect.objectContaining({ cta_id: 'home_runtime_parity_toggle', adapter: 'ag_ui' }),
    );
  });

  it('moves DOM focus to the newly checked radio on ArrowRight', async () => {
    const { RuntimeParityToggle } = await import('./RuntimeParityToggle');
    render(
      <RuntimeParityToggle
        configPanes={{ langgraph: <pre>LG CONFIG</pre>, ag_ui: <pre>AGUI CONFIG</pre> }}
        componentPane={<pre>COMPONENT</pre>}
      />,
    );
    const langgraphRadio = screen.getByRole('radio', { name: 'LangGraph' });
    const agUiRadio = screen.getByRole('radio', { name: 'AG-UI' });
    langgraphRadio.focus();
    fireEvent.keyDown(langgraphRadio, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(agUiRadio);
  });
});
