// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Differentiator } from './Differentiator';

vi.mock('../../lib/analytics/client', () => ({
  trackCtaClick: vi.fn(),
  trackExternalLinkClick: vi.fn(),
}));

vi.mock('../ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('../ui/Eyebrow', () => ({
  Eyebrow: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('@ngaf/design-tokens', () => ({
  tokens: {
    colors: {
      accent: '#7c3aed',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      textMuted: '#9ca3af',
    },
    surfaces: {
      border: '#e5e7eb',
    },
    typography: {
      h2: { family: 'sans-serif', size: '2rem', line: '1.2' },
      bodyLg: { family: 'sans-serif', size: '1.125rem', line: '1.6' },
      body: { family: 'sans-serif', size: '1rem', line: '1.5' },
      fontMono: 'monospace',
    },
  },
}));

import { trackCtaClick } from '../../lib/analytics/client';

const EXPECTED_NEEDS = [
  'Durable threads',
  'Resumable interrupts',
  'Tool calls as events',
  'Streaming state as signals',
  'Generative UI on your design system',
  'Recoverable errors',
  'Backend portability',
  'Angular-native',
  'Observability hooks',
  'MIT + self-hosted',
];

describe('Differentiator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section headline', () => {
    render(<Differentiator />);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Everything an Angular agent needs once the demo works.',
      }),
    ).toBeTruthy();
  });

  it('renders all 10 production-readiness rows', () => {
    render(<Differentiator />);
    for (const need of EXPECTED_NEEDS) {
      expect(screen.getByText(need)).toBeTruthy();
    }
  });

  it('renders the @ngaf/render primitive for the generative UI row', () => {
    render(<Differentiator />);
    expect(screen.getByText('@ngaf/render')).toBeTruthy();
  });

  it('links the footer CTA to /pilot-to-prod', () => {
    render(<Differentiator />);
    const link = screen.getByRole('link', { name: /Pilot to Prod/ });
    expect(link.getAttribute('href')).toBe('/pilot-to-prod');
  });

  it('fires the home_why_pilot_to_prod CTA event when the footer link is clicked', () => {
    render(<Differentiator />);
    const link = screen.getByRole('link', { name: /Pilot to Prod/ });
    fireEvent.click(link);
    expect(trackCtaClick).toHaveBeenCalledWith({
      surface: 'home',
      destination_url: '/pilot-to-prod',
      cta_id: 'home_why_pilot_to_prod',
      cta_text: 'Pilot to Prod',
    });
  });
});
