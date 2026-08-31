// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FinalCTA } from './FinalCTA';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
}));

describe('FinalCTA', () => {
  it('defaults to the tinted surface (used by 8 non-home pages)', () => {
    const { container } = render(<FinalCTA />);
    expect(
      container.querySelector('[data-ui="section"]')?.getAttribute('data-surface'),
    ).toBe('tinted');
  });

  it('renders the dark surface when variant="dark"', () => {
    const { container } = render(<FinalCTA variant="dark" />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    expect(container.querySelector('.final-cta-mark')).toBeTruthy();
  });
});
