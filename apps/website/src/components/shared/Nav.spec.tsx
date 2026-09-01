// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Nav } from './Nav';

const { trackCtaClick } = vi.hoisted(() => ({
  trackCtaClick: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/docs/langgraph/guides/streaming',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../lib/analytics/client', () => ({
  trackCtaClick,
  trackExternalLinkClick: vi.fn(),
}));

describe('Docs mobile navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    trackCtaClick.mockClear();
  });

  it('uses the existing header trigger for the control-plane Docs drawer', () => {
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Docs' }).getAttribute('data-active')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Scope' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Learn' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close menu' })).toBeTruthy();
  });

  it('closes from the global control inside the dialog and restores trigger focus', async () => {
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close menu' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape and restores focus to the sole trigger', async () => {
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the drawer open when Escape dismisses the nested library menu', () => {
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
    const libraryTrigger = within(dialog).getByRole('button', { name: 'LangGraph' });
    fireEvent.click(libraryTrigger);

    fireEvent.keyDown(within(dialog).getByRole('menuitemradio', { name: /LangGraph/ }), {
      key: 'Escape',
    });

    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(libraryTrigger);
  });

  it('closes the drawer before dispatching mobile search', async () => {
    const searchListener = vi.fn();
    document.addEventListener('keydown', searchListener);
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    fireEvent.click(screen.getByRole('button', { name: 'Search docs' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull());
    await waitFor(() => expect(searchListener).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'k', metaKey: true }),
    ));
    document.removeEventListener('keydown', searchListener);
  });

  it('preserves the Site tab alongside the Docs control plane', () => {
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Site' }));

    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
    expect(within(dialog).getByRole('link', { name: 'Pricing' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Scope' })).toBeNull();
  });

  it('preserves page-level analytics for Docs links', () => {
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
    fireEvent.click(within(dialog).getByRole('link', { name: 'Streaming' }));

    expect(trackCtaClick).toHaveBeenCalledWith({
      surface: 'mobile_nav',
      destination_url: '/docs/langgraph/guides/streaming',
      cta_id: 'mobile_nav_docs_page',
      cta_text: 'Streaming',
      library: 'langgraph',
    });
  });
});
