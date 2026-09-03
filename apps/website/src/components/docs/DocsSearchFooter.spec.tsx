// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DocsSearchFooter } from './DocsSearchFooter';

describe('DocsSearchFooter', () => {
  it('opens search from a real button, not a keyboard instruction', () => {
    const listener = vi.fn();
    document.addEventListener('keydown', listener);
    render(<DocsSearchFooter />);

    // The old copy read "Press ⌘K to search the docs" as static text, which
    // is unactionable on a device with no ⌘K.
    fireEvent.click(screen.getByRole('button', { name: /Search the docs/ }));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'k', metaKey: true })
    );
    document.removeEventListener('keydown', listener);
  });

  it('keeps the shortcut as a hint', () => {
    const { container } = render(<DocsSearchFooter />);
    const pill = container.querySelector('[data-ui="pill"]');
    expect(pill?.textContent).toBe('⌘K');
    // Decoration, not part of the accessible name — see the exact-name
    // assertion below, which would fail if this regressed.
    expect(pill?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the ⌘K pill out of the button accessible name', () => {
    render(<DocsSearchFooter />);
    expect(
      screen.getByRole('button', { name: 'Search the docs' })
    ).toBeTruthy();
  });
});
