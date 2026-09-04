// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/analytics/client', () => ({ track: vi.fn(), trackCtaClick: vi.fn(), trackExternalLinkClick: vi.fn() }));
vi.mock('server-only', () => ({}));

import ContactPage from './page';

describe('ContactPage', () => {
  it('renders the contact variant by default', async () => {
    render(await ContactPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText('Contact', { selector: '[data-ui="eyebrow"]' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Talk to an engineer.');
    expect(screen.getByRole('button', { name: 'Send to Brian' })).toBeTruthy();
    expect(screen.queryByLabelText('Timeline')).toBeNull();
    expect(screen.getByRole('link', { name: 'brian@threadplane.ai' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GitHub issues' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Discord' })).toBeTruthy();
  });

  it('renders the enterprise variant from the intent query and passes the entry point through', async () => {
    render(await ContactPage({ searchParams: Promise.resolve({ intent: 'enterprise', entry: 'pricing_tier_enterprise' }) }));
    expect(screen.getByText('Enterprise', { selector: '[data-ui="eyebrow"]' })).toBeTruthy();
    expect(screen.getByLabelText('Timeline')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request a conversation' })).toBeTruthy();
  });

  it('ignores unknown intents and unsafe entry values', async () => {
    render(await ContactPage({ searchParams: Promise.resolve({ intent: 'weird', entry: '<script>' }) }));
    expect(screen.getByRole('button', { name: 'Send to Brian' })).toBeTruthy();
  });
});
