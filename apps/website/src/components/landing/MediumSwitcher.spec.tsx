// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediumSwitcher } from './MediumSwitcher';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: trackCtaClickMock }));

describe('MediumSwitcher', () => {
  it('renders a lone medium with no tablist', () => {
    render(
      <MediumSwitcher
        sectionId="stream"
        panes={[{ key: 'video', label: 'Video', content: <p>the clip</p> }]}
      />,
    );

    expect(screen.getByText('the clip')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
  const twoPanes = [
    { key: 'video' as const, label: 'Video', content: <p>the clip</p> },
    { key: 'code' as const, label: 'Code', content: <p>the snippet</p> },
  ];

  it('exposes a tab per medium with the first selected', () => {
    render(<MediumSwitcher sectionId="stream" panes={twoPanes} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('points each tab at the panel it controls', () => {
    render(<MediumSwitcher sectionId="stream" panes={twoPanes} />);

    const tab = screen.getAllByRole('tab')[0];
    const panel = screen.getByRole('tabpanel');
    expect(tab.getAttribute('aria-controls')).toBe(panel.getAttribute('id'));
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.getAttribute('id'));
  });

  it('mounts only the active pane', () => {
    render(<MediumSwitcher sectionId="stream" panes={twoPanes} />);

    // Not "hidden" — absent. A CSS-toggled implementation would still fetch the
    // video and the iframe on page load, which is the cost this avoids.
    expect(screen.getByText('the clip')).toBeTruthy();
    expect(screen.queryByText('the snippet')).toBeNull();
  });

  it('swaps which pane is mounted when a tab is clicked', () => {
    render(<MediumSwitcher sectionId="stream" panes={twoPanes} />);

    fireEvent.click(screen.getAllByRole('tab')[1]);

    expect(screen.queryByText('the clip')).toBeNull();
    expect(screen.getByText('the snippet')).toBeTruthy();
  });

  it('moves between tabs with arrow keys, wrapping at the ends', () => {
    render(<MediumSwitcher sectionId="stream" panes={twoPanes} />);
    const tablist = screen.getByRole('tablist');

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getAllByRole('tab')[1]);

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');
  });

  it('jumps to the first and last tab with Home and End', () => {
    render(<MediumSwitcher sectionId="stream" panes={twoPanes} />);
    const tablist = screen.getByRole('tablist');

    fireEvent.keyDown(tablist, { key: 'End' });
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true');
  });

  it('reports the medium a reader switches to', () => {
    trackCtaClickMock.mockClear();
    render(<MediumSwitcher sectionId="stream" panes={twoPanes} />);

    fireEvent.click(screen.getAllByRole('tab')[1]);

    expect(trackCtaClickMock).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'home_medium_switcher', cta_id: 'medium_stream_code' }),
    );
  });

  it('does not report the medium a reader never chose', () => {
    trackCtaClickMock.mockClear();
    render(<MediumSwitcher sectionId="stream" panes={twoPanes} />);

    // Rendering is not a choice; only an explicit switch is.
    expect(trackCtaClickMock).not.toHaveBeenCalled();
  });
});
