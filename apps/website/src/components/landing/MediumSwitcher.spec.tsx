// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediumSwitcher } from './MediumSwitcher';

vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: vi.fn() }));

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
});
