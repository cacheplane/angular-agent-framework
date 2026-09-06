// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TeamsBlock } from './TeamsBlock';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
  trackWhitepaperDownloadClick: vi.fn(),
}));

const formPolicy = {
  version: 'test',
  disclosures: { whitepaper: 'Whitepaper disclosure', newsletter: 'Newsletter disclosure', contact: 'Contact disclosure' },
} as never;

describe('TeamsBlock', () => {
  it('renders the pilot heading, four outcomes, four phases, both CTAs, and one email form', () => {
    const { container } = render(<TeamsBlock formPolicy={formPolicy} />);
    expect(screen.getByRole('heading', { name: 'Shipping inside a large Angular platform?' }).id).toBe('pilot-heading');
    expect(container.querySelectorAll('.pilot-row')).toHaveLength(4);
    expect(container.querySelectorAll('.pilot-step')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Talk to an engineer' }).getAttribute('href')).toBe('/contact?source=home_enterprise&track=enterprise');
    expect(screen.getByRole('link', { name: 'See the pilot program' }).getAttribute('href')).toBe('/pilot-to-prod');
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByText('Whitepaper disclosure')).toBeTruthy();
  });

  it('frames the field report as the takeaway, not a second section', () => {
    render(<TeamsBlock formPolicy={formPolicy} />);
    expect(screen.getByText('Field report')).toBeTruthy();
    expect(screen.getByText('From Prototype to Production')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'The last-mile gap in Angular AI.' })).toBeNull();
  });
});
