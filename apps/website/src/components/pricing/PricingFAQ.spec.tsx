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
  'Is Threadplane free?',
  'Is @threadplane/chat open source?',
  'What counts as commercial use?',
  'Does Threadplane have a cloud service?',
  'Does Threadplane store my conversations or agent data?',
  'Are model or hosting costs included?',
  'What am I paying for?',
  'Do my end users need licenses?',
  'What is a developer seat?',
  'Does a paid plan unlock different software?',
  'How does the license token work?',
  'Can I modify or redistribute the source?',
  'What happens after cancellation or refund?',
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

  it('explains offline advisory token verification without a licensing API call', () => {
    render(<PricingFAQ />);
    expect(screen.getByText(/Ed25519/i)).toBeTruthy();
    expect(screen.getByText(/does not call a Threadplane licensing API/i)).toBeTruthy();
    expect(screen.getByText(/does not block rendering/i)).toBeTruthy();
  });
});
