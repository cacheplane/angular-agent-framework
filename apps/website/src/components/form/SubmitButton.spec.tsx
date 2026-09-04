// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubmitButton } from './SubmitButton';

describe('SubmitButton', () => {
  it('renders both labels so width is stable, exposes only the active one, and disables while pending', () => {
    const { rerender } = render(<SubmitButton pendingLabel="Sending…">Send to Brian</SubmitButton>);
    const button = screen.getByRole('button', { name: 'Send to Brian' }) as HTMLButtonElement;
    expect(button.type).toBe('submit');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('data-pending')).toBeNull();
    expect(button.getAttribute('data-submit')).toBe('');
    expect(button.getAttribute('data-ui')).toBe('button');
    expect(button.querySelector('[data-slot="pending"]')?.textContent).toBe('Sending…');

    rerender(<SubmitButton pending pendingLabel="Sending…">Send to Brian</SubmitButton>);
    const pending = screen.getByRole('button', { name: 'Sending…' }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);
    expect(pending.getAttribute('data-pending')).toBe('');
    expect(pending.getAttribute('aria-busy')).toBe('true');
  });
});
