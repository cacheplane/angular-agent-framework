// @vitest-environment jsdom
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompareTable } from './CompareTable';

vi.mock('../../lib/analytics/client', () => ({
  trackCtaClick: vi.fn(),
}));

describe('CompareTable', () => {
  it('presents the three public paths in journey order', () => {
    render(<CompareTable />);

    const plans = screen.getAllByRole('article');
    expect(plans).toHaveLength(3);
    expect(
      plans.map((plan) => within(plan).getByRole('heading', { level: 3 }).textContent),
    ).toEqual(['Community', 'Production Assurance', 'Enterprise']);
  });

  it('makes the complete software stack free under MIT', () => {
    render(<CompareTable />);

    const community = screen.getByRole('article', { name: /Community/i });
    expect(within(community).getByText(/Free forever/i)).toBeTruthy();
    expect(within(community).getByText(/All packages are MIT-licensed/i)).toBeTruthy();
  });

  it('has no billing controls or checkout forms', () => {
    render(<CompareTable />);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
  });

  it('routes software users to npm and service buyers to contact', () => {
    render(<CompareTable />);
    expect(screen.getByRole('link', { name: 'Install from npm' }).getAttribute('href')).toContain(
      '@threadplane/chat',
    );
    expect(screen.getByRole('link', { name: 'Discuss assurance' }).getAttribute('href')).toBe(
      '/contact?intent=enterprise&entry=pricing_tier_production_assurance',
    );
    expect(screen.getByRole('link', { name: 'Talk to Sales' }).getAttribute('href')).toBe(
      '/contact?intent=enterprise&entry=pricing_tier_enterprise',
    );
  });
});
