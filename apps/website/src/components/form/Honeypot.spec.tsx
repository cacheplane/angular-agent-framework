import { fireEvent, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Honeypot, readHoneypot } from './Honeypot';

it('keeps the trap out of normal navigation but includes bot input in form facts', () => {
  const { container } = render(
    <form>
      <Honeypot />
    </form>
  );
  const input = container.querySelector('input');
  const form = container.querySelector('form');
  if (!input || !form) throw new Error('Expected form trap');
  expect(input.tabIndex).toBe(-1);
  expect(input.getAttribute('autocomplete')).toBe('off');
  expect(input.closest('[aria-hidden="true"]')).not.toBeNull();
  expect(readHoneypot(form)).toBe('');
  fireEvent.change(input, { target: { value: 'https://spam.invalid' } });
  expect(readHoneypot(form)).toBe(
    'https://spam.invalid'
  );
});
