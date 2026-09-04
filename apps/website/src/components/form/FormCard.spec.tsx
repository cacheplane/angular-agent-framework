// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { FormCard } from './FormCard';

describe('FormCard', () => {
  it('renders the card shell and forwards the compact flag', () => {
    const { container, rerender } = render(<FormCard>body</FormCard>);
    const card = container.querySelector('[data-ui="form-card"]');
    expect(card?.textContent).toBe('body');
    expect(card?.getAttribute('data-compact')).toBeNull();
    rerender(<FormCard compact>body</FormCard>);
    expect(container.querySelector('[data-ui="form-card"]')?.getAttribute('data-compact')).toBe('');
  });
});
