// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThanksPage from './page';

vi.mock('../../components/ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../components/ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('../../components/ui/Eyebrow', () => ({
  Eyebrow: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, href }: { children: React.ReactNode; href?: string }) =>
    <a href={href}>{children}</a>,
}));

describe('ThanksPage', () => {
  // ThanksPage is an async Server Component taking `searchParams: Promise<...>`.
  // Rendering it as JSX synchronously yields an empty DOM — which is why every
  // assertion in this file failed against `<body><div /></body>`. Await the
  // component and render the element it resolves to.
  const renderPage = async (searchParams: { session_id?: string } = {}) =>
    render(await ThanksPage({ searchParams: Promise.resolve(searchParams) }));

  it('renders the payment-received heading', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Thanks for your purchase.' })).toBeTruthy();
  });

  it('mentions provideChat() activation', async () => {
    await renderPage();
    expect(screen.getByText(/provideChat\(\)/)).toBeTruthy();
  });

  it('links to licensing docs and contact', async () => {
    await renderPage();
    expect(screen.getByRole('link', { name: 'Installation & licensing' }).getAttribute('href'))
      .toBe('/docs/licensing');
    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href'))
      .toBe('/contact');
  });

  it('offers the billing portal only for a well-formed Stripe session id', async () => {
    const { unmount } = await renderPage({ session_id: 'cs_test_abc123' });
    expect(screen.getByRole('link', { name: 'Manage subscription' }).getAttribute('href'))
      .toBe('/api/portal/session?session_id=cs_test_abc123');
    unmount();

    // A malformed id must not produce a portal link — this is the guard that
    // keeps an arbitrary query value out of the portal URL.
    await renderPage({ session_id: 'not-a-session' });
    expect(screen.queryByRole('link', { name: 'Manage subscription' })).toBeNull();
  });
});
