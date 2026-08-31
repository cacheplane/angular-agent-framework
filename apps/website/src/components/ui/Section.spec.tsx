import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Section } from './Section';

describe('Section', () => {
  it('renders data-surface="dark" when asked', () => {
    const { container } = render(<Section surface="dark">x</Section>);
    const el = container.querySelector('[data-ui="section"]');
    expect(el?.getAttribute('data-surface')).toBe('dark');
  });

  it('defaults to canvas', () => {
    const { container } = render(<Section>x</Section>);
    expect(
      container.querySelector('[data-ui="section"]')?.getAttribute('data-surface'),
    ).toBe('canvas');
  });
});
