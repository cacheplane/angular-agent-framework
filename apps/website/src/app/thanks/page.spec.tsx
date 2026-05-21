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
  it('renders the payment-received heading', () => {
    render(<ThanksPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Thanks for your purchase.' })).toBeTruthy();
  });

  it('mentions provideChat() activation', () => {
    render(<ThanksPage />);
    expect(screen.getByText(/provideChat\(\)/)).toBeTruthy();
  });

  it('links to installation docs and contact', () => {
    render(<ThanksPage />);
    expect(screen.getByRole('link', { name: 'Installation docs' }).getAttribute('href'))
      .toBe('/docs/chat/getting-started/installation');
    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href'))
      .toBe('/contact');
  });
});
