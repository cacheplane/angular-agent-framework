// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { a2uiActionLabel } from './action-label';

describe('a2uiActionLabel', () => {
  it('returns the authored label when action.label is present', () => {
    const content = JSON.stringify({
      version: 'v1',
      action: { name: 'bookingSubmit', label: 'Search flights' },
    });
    expect(a2uiActionLabel(content)).toBe('Search flights');
  });

  it('falls back to camelCase humanization when no label', () => {
    const content = JSON.stringify({ version: 'v1', action: { name: 'bookingSubmit' } });
    expect(a2uiActionLabel(content)).toBe('Booking submit');
  });

  it('humanizes single-word action name', () => {
    const content = JSON.stringify({ version: 'v1', action: { name: 'submit' } });
    expect(a2uiActionLabel(content)).toBe('Submit');
  });

  it('humanizes multi-camel action name', () => {
    const content = JSON.stringify({ version: 'v1', action: { name: 'addItemToCart' } });
    expect(a2uiActionLabel(content)).toBe('Add item to cart');
  });

  it('returns null for non-v1 messages', () => {
    expect(a2uiActionLabel('{"version":"v2","action":{"name":"x"}}')).toBeNull();
  });

  it('returns null for non-action JSON', () => {
    expect(a2uiActionLabel('{"foo":"bar"}')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(a2uiActionLabel('Hello world')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(a2uiActionLabel('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(a2uiActionLabel('{not json')).toBeNull();
  });

  it('prefers authored label over humanization', () => {
    // Even if name would humanize to "Foo bar", the label wins.
    const content = JSON.stringify({
      version: 'v1',
      action: { name: 'fooBar', label: 'Custom Label' },
    });
    expect(a2uiActionLabel(content)).toBe('Custom Label');
  });

  it('falls back to humanization when label is empty string', () => {
    const content = JSON.stringify({
      version: 'v1',
      action: { name: 'fooBar', label: '' },
    });
    expect(a2uiActionLabel(content)).toBe('Foo bar');
  });
});
