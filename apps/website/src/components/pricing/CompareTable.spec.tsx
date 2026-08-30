// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompareTable } from './CompareTable';

vi.mock('../../lib/analytics/client', () => ({
  trackCtaClick: vi.fn(),
}));

describe('CompareTable', () => {
  it('presents the four public stages in journey order', () => {
    render(<CompareTable />);

    const plans = screen.getAllByRole('article');
    expect(plans).toHaveLength(4);
    expect(
      plans.map((plan) => within(plan).getByRole('heading', { level: 3 }).textContent),
    ).toEqual(['Developer', 'Pro', 'Team', 'Enterprise']);
  });

  it('shows the required free-use restrictions before the FAQ', () => {
    render(<CompareTable />);

    const developer = screen.getByRole('article', { name: /Developer/i });
    expect(within(developer).getByText(/Free forever/i)).toBeTruthy();
    expect(within(developer).getByText(/For permitted noncommercial use/i)).toBeTruthy();
    expect(within(developer).getByText(/30-day commercial evaluation/i)).toBeTruthy();
  });

  it('keeps annual selected initially and makes the savings claim non-universal', () => {
    render(<CompareTable />);

    const annual = screen.getByRole('radio', { name: /Annual/i });
    const monthly = screen.getByRole('radio', { name: /Monthly/i });
    expect(annual.getAttribute('aria-checked')).toBe('true');
    expect(monthly.getAttribute('aria-checked')).toBe('false');
    expect(annual.getAttribute('aria-label')).toMatch(/save up to 16%/i);
    expect(annual.getAttribute('aria-label')).not.toMatch(/Annual — save 16%$/i);
  });

  it('maps public Pro and Team CTAs to stable checkout slugs', () => {
    render(<CompareTable />);

    const proButton = screen.getByRole('button', { name: 'Get Pro' });
    const proForm = proButton.closest('form');
    expect(proForm?.querySelector<HTMLInputElement>('input[name="tier"]')?.value).toBe(
      'developer_seat',
    );

    const teamButton = screen.getByRole('button', { name: 'Get Team' });
    const teamForm = teamButton.closest('form');
    expect(teamForm?.querySelector<HTMLInputElement>('input[name="tier"]')?.value).toBe('team');
  });

  it('keeps free and enterprise actions out of paid checkout', () => {
    render(<CompareTable />);

    expect(screen.getByRole('link', { name: 'Start free' }).getAttribute('href')).toContain(
      '@threadplane/chat',
    );
    expect(screen.getByRole('link', { name: 'Talk to Sales' }).getAttribute('href')).toBe(
      '/contact?source=pricing_tier_enterprise',
    );
  });

  it('switches exact paid prices without changing tier structure', () => {
    render(<CompareTable />);

    expect(screen.getByRole('article', { name: /Pro/i }).textContent).toContain('$299');
    expect(screen.getByRole('article', { name: /Team/i }).textContent).toContain('$1,495');
    expect(screen.getAllByText(/billed annually/i).length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('radio', { name: /Monthly/i }));

    expect(screen.getByRole('article', { name: /Pro/i }).textContent).toContain('$29');
    expect(screen.getByRole('article', { name: /Team/i }).textContent).toContain('$149');
  });
});
