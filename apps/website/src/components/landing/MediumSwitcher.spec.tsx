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
});
