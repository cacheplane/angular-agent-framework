// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<Modal open={false} onClose={vi.fn()} label="x"><p>hi</p></Modal>);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders a labelled modal dialog with its children and focuses the close button', () => {
    render(<Modal open onClose={vi.fn()} label="Install Threadplane"><p>hi</p></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Install Threadplane' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('hi')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('closes on Escape and on backdrop mousedown, not on frame mousedown', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} label="x"><p>hi</p></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(screen.getByText('hi'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('labels via aria-labelledby and omits aria-label when labelledBy is set', () => {
    render(
      <Modal open onClose={vi.fn()} label="Install Threadplane" labelledBy="dialog-title">
        <h2 id="dialog-title">Install Threadplane</h2>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Install Threadplane' });
    expect(dialog.getAttribute('aria-labelledby')).toBe('dialog-title');
    expect(dialog.getAttribute('aria-label')).toBeNull();
  });

  it('locks body scroll while open and restores it', () => {
    const { unmount } = render(<Modal open onClose={vi.fn()} label="x"><p>hi</p></Modal>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
