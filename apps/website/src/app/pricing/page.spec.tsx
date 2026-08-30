// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PricingPage, { metadata } from './page';

vi.mock('../../components/pricing/LeadForm', () => ({ LeadForm: () => null }));
vi.mock('../../components/landing/FinalCTA', () => ({ FinalCTA: () => null }));
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: vi.fn() }));

describe('PricingPage', () => {
  it('answers the licensing and hosting questions above the comparison', () => {
    render(<PricingPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'From prototype to production.' })).toBeTruthy();
    expect(screen.getByText(/Most packages are MIT/i)).toBeTruthy();
    expect(screen.getByText(/requires a license for commercial production/i)).toBeTruthy();
    expect(screen.getByText(/No Threadplane cloud/i)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Same software/i })).toBeTruthy();
    expect(screen.getByText(/does not host your agents or conversations/i)).toBeTruthy();
    expect(screen.getByText(/durable persistence.*connected backend/i)).toBeTruthy();
  });

  it('renders one grouped comparison with semantic row and column headers', () => {
    const { container } = render(<PricingPage />);

    expect(screen.getByRole('table', { name: /Full plan comparison/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Developer' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Pro' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Commercial production rights for @threadplane/chat' })).toBeTruthy();
    expect(container.querySelectorAll('table[aria-label="Full plan comparison"]')).toHaveLength(1);
  });

  it('does not present hosted-product quotas or bundled infrastructure', () => {
    const { container } = render(<PricingPage />);
    const text = container.textContent?.toLowerCase() ?? '';

    for (const prohibited of [
      'max threads',
      'hosted storage',
      'cloud hosting included',
      'channels credits',
      'model credits',
    ]) {
      expect(text).not.toContain(prohibited);
    }
  });

  it('uses licensing-accurate search metadata', () => {
    const description = String(metadata.description);
    expect(description).toContain('Most Threadplane packages are MIT-licensed');
    expect(description).toContain('@threadplane/chat');
    expect(description).toContain('$29 per developer per month');
    expect(description).toContain('your own stack');
  });
});
