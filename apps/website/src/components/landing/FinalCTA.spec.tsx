// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FinalCTA } from './FinalCTA';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
  trackExternalLinkClick: vi.fn(),
}));

describe('FinalCTA', () => {
  it('defaults to the tinted surface (used by 4 non-home pages)', () => {
    const { container } = render(<FinalCTA />);
    expect(
      container.querySelector('[data-ui="section"]')?.getAttribute('data-surface'),
    ).toBe('tinted');
  });

  it('renders the dark surface when variant="dark"', () => {
    const { container } = render(<FinalCTA variant="dark" />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    expect(container.querySelector('.final-cta-mark')).toBeTruthy();
    expect(container.querySelector('.final-cta-mark')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults its secondary action to the same-origin streaming workspace', () => {
    render(<FinalCTA />);

    const link = screen.getByRole('link', {
      name: 'See each feature in action →',
    });
    expect(link.getAttribute('href')).toBe(
      '/docs/langgraph/guides/streaming?mode=run'
    );
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBeNull();
  });
});
