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
    expect(container.querySelector('[data-ui="pill"]')?.textContent).toBe('⌘K');
  });
});
