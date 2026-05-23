// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PricingFAQ } from './PricingFAQ';

vi.mock('../ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('../ui/Eyebrow', () => ({
  Eyebrow: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const EXPECTED_QUESTIONS = [
  'Is @ngaf/chat open source?',
  'Can I use it for free?',
  'Can I use it at work?',
  'Do my end users need licenses?',
  'Can I modify the source?',
  'Can I redistribute it?',
];

describe('PricingFAQ', () => {
  it('renders the FAQ heading', () => {
    render(<PricingFAQ />);
    expect(
      screen.getByRole('heading', { level: 2, name: /Licensing FAQ/ }),
    ).toBeTruthy();
  });

  it('renders all questions as <summary> elements inside <details>', () => {
    const { container } = render(<PricingFAQ />);
    const summaries = container.querySelectorAll('details > summary');
    expect(summaries.length).toBe(EXPECTED_QUESTIONS.length);
    const texts = Array.from(summaries, (s) => s.querySelector('span')?.textContent?.trim());
    expect(texts).toEqual(EXPECTED_QUESTIONS);
  });

  it('exposes an #faq anchor for footer deep-linking', () => {
    const { container } = render(<PricingFAQ />);
    expect(container.querySelector('#faq')).toBeTruthy();
  });

  it('renders the open-source clarification answer', () => {
    render(<PricingFAQ />);
    expect(
      screen.getByText(/source-available under the PolyForm Noncommercial License 1\.0\.0/i),
    ).toBeTruthy();
  });
});
