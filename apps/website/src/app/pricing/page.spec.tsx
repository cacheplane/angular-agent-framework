// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import PricingPage, { metadata } from './page';

vi.mock('../../components/pricing/EnterpriseCtaBand', () => ({ EnterpriseCtaBand: () => null }));
vi.mock('../../components/landing/FinalCTA', () => ({ FinalCTA: () => null }));
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: vi.fn() }));

describe('PricingPage', () => {
  it('answers the software and hosting questions above the comparison', () => {
    render(<PricingPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'From prototype to production.' })).toBeTruthy();
    expect(screen.getByText(/Every package is MIT/i)).toBeTruthy();
    expect(screen.getByText(/commercial products, internal tools, and client work/i)).toBeTruthy();
    expect(screen.getByText(/No Threadplane cloud/i)).toBeTruthy();
    expect(screen.getByText(/Angular 20, 21, 22, CI-tested/i)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Open software/i })).toBeTruthy();
    expect(screen.getByText(/does not host your agents or conversations/i)).toBeTruthy();
    expect(screen.getByText(/durable persistence.*connected backend/i)).toBeTruthy();
  });

  it('renders one grouped comparison with semantic row and column headers', () => {
    const { container } = render(<PricingPage />);

    expect(screen.getByRole('table', { name: /Full plan comparison/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Community' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Production Assurance' })).toBeTruthy();
    expect(screen.queryByRole('rowheader', { name: 'MIT-licensed software' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: 'Private support channel' })).toBeTruthy();
    expect(screen.getByText(/identical on every path/i)).toBeTruthy();
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

  it('uses MIT and services-accurate search metadata', () => {
    const description = String(metadata.description);
    expect(description).toContain('Every Threadplane package is MIT-licensed');
    expect(description).toContain('Production Assurance');
    expect(description).not.toContain('$29');
    expect(description).toContain('your own stack');
  });
});
