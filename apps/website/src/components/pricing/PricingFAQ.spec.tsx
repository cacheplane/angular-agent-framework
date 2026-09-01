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
  'Does Threadplane have a cloud service?',
  'Does Threadplane store my conversations or agent data?',
  'Are model or hosting costs included?',
  'What am I paying for?',
  'What is Production Assurance?',
  'What is Pilot-to-Prod?',
];

describe('PricingFAQ', () => {
  it('renders the FAQ heading', () => {
    render(<PricingFAQ />);
    expect(
      screen.getByRole('heading', { level: 2, name: /Pricing FAQ/ }),
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

  it('describes Production Assurance as a scoped support relationship', () => {
    render(<PricingFAQ />);
    expect(screen.getByText(/Production Assurance is a scoped support relationship/i)).toBeTruthy();
  });
});
