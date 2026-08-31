import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('renders eyebrow, heading with id, and aside in rail variant', () => {
    const { container } = render(
      <SectionHeader
        variant="rail"
        eyebrow="The Yes wall"
        heading="Yes, it does that."
        headingId="yes-wall-heading"
        aside="Sixteen questions teams ask before they commit."
      />,
    );
    const root = container.querySelector('[data-ui="section-header"]');
    expect(root?.getAttribute('data-variant')).toBe('rail');
    expect(screen.getByText('The Yes wall')).toBeTruthy();
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.id).toBe('yes-wall-heading');
    expect(h2.textContent).toBe('Yes, it does that.');
    expect(screen.getByText(/Sixteen questions/)).toBeTruthy();
  });

  it('defaults to centered variant with no aside', () => {
    const { container } = render(
      <SectionHeader eyebrow="Reliable" heading="Proof." />,
    );
    expect(
      container.querySelector('[data-ui="section-header"]')?.getAttribute('data-variant'),
    ).toBe('centered');
  });
});
