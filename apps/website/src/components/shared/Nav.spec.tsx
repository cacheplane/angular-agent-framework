// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Nav } from './Nav';

const { trackCtaClick, pathnameRef } = vi.hoisted(() => ({
  trackCtaClick: vi.fn(),
  pathnameRef: { current: '/docs/langgraph/guides/streaming' },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
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
    pathnameRef.current = '/docs/langgraph/guides/streaming';
  });

  it('names the docs index the same way the page does', () => {
    pathnameRef.current = '/docs';
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });

    // The page passes pageTitle="Overview"; Nav derives its own title from
    // the URL independently. That comparison used to be visible through the
    // Scope card, which is gone (Task 3) — the trail is the shell header's
    // job now. What is left to verify here is that the docs index still
    // renders its control plane content correctly, search included.
    expect(within(dialog).getByRole('button', { name: 'Search docs' })).toBeTruthy();
  });

  it('does not invent a library on a library-neutral docs page', () => {
    pathnameRef.current = '/docs/choosing-an-adapter';
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });

    // `/docs/choosing-an-adapter` has no library segment. Falling back to
    // 'langgraph' made the Scope card read "LangGraph / Getting Started /
    // Documentation" — three fabrications in the one card whose job was
    // saying where you are. That card is gone now (Task 3); what remains
    // observable is that the drawer still does not fabricate a library
    // selection for a library-neutral page.
    expect(within(dialog).queryByRole('button', { name: 'LangGraph' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Choose a library' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Search docs' })).toBeTruthy();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const installDesktopMediaQuery = () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        media: '(min-width: 64rem)',
        onchange: null,
        addEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => listeners.add(listener),
        removeEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => listeners.delete(listener),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
    return () => {
      act(() => {
        for (const listener of listeners) {
          listener({ matches: true } as MediaQueryListEvent);
        }
      });
    };
  };

  const expectFocusAfterDrawerUnmount = (trigger: HTMLButtonElement) => {
    const nativeFocus = trigger.focus.bind(trigger);
    const observation = { drawerWasMounted: undefined as boolean | undefined };
    const focus = vi.spyOn(trigger, 'focus').mockImplementation(() => {
      observation.drawerWasMounted = Boolean(
        screen.queryByRole('dialog', { name: 'Mobile navigation' }),
      );
      nativeFocus();
    });
    return { focus, observation };
  };

  it('retires Examples from desktop navigation without changing primary destinations or demos', () => {
    pathnameRef.current = '/';
    render(<Nav />);

    const navigation = screen.getByRole('navigation');
    expect(
      within(navigation).queryByRole('link', { name: 'Examples' }),
    ).toBeNull();
    expect(
      within(navigation)
        .getByRole('link', { name: 'Pilot to Prod' })
        .getAttribute('href'),
    ).toBe('/pilot-to-prod');
    expect(
      within(navigation)
        .getByRole('link', { name: 'Docs' })
        .getAttribute('href'),
    ).toBe('/docs');
    expect(
      within(navigation)
        .getByRole('link', { name: 'Pricing' })
        .getAttribute('href'),
    ).toBe('/pricing');
    expect(
      within(navigation)
        .getByRole('link', { name: 'GitHub repository' })
        .getAttribute('href'),
    ).toBe(
      'https://github.com/cacheplane/angular-agent-framework',
    );

    fireEvent.click(within(navigation).getByRole('button', { name: /^Demo/ }));
    expect(
      within(navigation)
        .getByRole('link', { name: 'LangGraph demo' })
        .getAttribute('href'),
    ).toBe(
      'https://demo.threadplane.ai',
    );
    expect(
      within(navigation)
        .getByRole('link', { name: 'AG-UI demo' })
        .getAttribute('href'),
    ).toBe(
      'https://ag-ui.threadplane.ai',
    );
  });

  it('retires Examples from mobile navigation without changing primary destinations or demos', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
    expect(within(dialog).queryByRole('link', { name: 'Examples' })).toBeNull();
    expect(
      within(dialog)
        .getByRole('link', { name: 'Pilot to Prod' })
        .getAttribute('href'),
    ).toBe('/pilot-to-prod');
    expect(
      within(dialog).getByRole('link', { name: 'Docs' }).getAttribute('href'),
    ).toBe('/docs');
    expect(
      within(dialog).getByRole('link', { name: 'Pricing' }).getAttribute('href'),
    ).toBe('/pricing');
    expect(
      within(dialog)
        .getByRole('link', { name: 'LangGraph demo' })
        .getAttribute('href'),
    ).toBe(
      'https://demo.threadplane.ai',
    );
    expect(
      within(dialog)
        .getByRole('link', { name: 'AG-UI demo' })
        .getAttribute('href'),
    ).toBe(
      'https://ag-ui.threadplane.ai',
    );
    expect(
      within(dialog)
        .getByRole('link', { name: /GitHub/ })
        .getAttribute('href'),
    ).toBe(
      'https://github.com/cacheplane/angular-agent-framework',
    );
  });

  it('uses the existing header trigger for the control-plane Docs drawer', () => {
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Docs' }).getAttribute('data-active')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Search docs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Learn' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close menu' })).toBeTruthy();
  });

  it('closes from the global control inside the dialog and restores trigger focus', async () => {
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    const { focus, observation } = expectFocusAfterDrawerUnmount(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close menu' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(focus).toHaveBeenCalledOnce());
    expect(observation.drawerWasMounted).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape and restores focus to the sole trigger', async () => {
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    const { focus, observation } = expectFocusAfterDrawerUnmount(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(focus).toHaveBeenCalledOnce());
    expect(observation.drawerWasMounted).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes after Docs link navigation and restores focus after unmount', async () => {
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    const { focus, observation } = expectFocusAfterDrawerUnmount(trigger);

    const destination = within(screen.getByRole('dialog')).getByRole('link', {
      name: 'Persistence',
    });
    expect(destination.getAttribute('href')).toBe('/docs/langgraph/guides/persistence');
    fireEvent.click(destination);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(focus).toHaveBeenCalledOnce());
    expect(observation.drawerWasMounted).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes and unlocks the page at the desktop breakpoint without restoring mobile intent', async () => {
    const crossToDesktop = installDesktopMediaQuery();
    const searchListener = vi.fn();
    document.addEventListener('keydown', searchListener);
    render(
      <>
        <Nav />
        <div id="site-content"><button type="button">Page content</button></div>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    const focus = vi.spyOn(trigger, 'focus');
    const nav = document.querySelector<HTMLElement>('.nav-bar');
    const siteContent = document.getElementById('site-content');
    if (!nav || !siteContent) throw new Error('Expected modal background surfaces');

    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    expect(nav.inert).toBe(true);
    expect(siteContent.inert).toBe(true);

    crossToDesktop();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('');
    expect(nav.inert).toBe(false);
    expect(siteContent.inert).toBe(false);
    expect(focus).not.toHaveBeenCalled();
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(searchListener).not.toHaveBeenCalled();
    document.removeEventListener('keydown', searchListener);
  });

  it('cancels queued search and focus when the breakpoint changes after dismissal', () => {
    const crossToDesktop = installDesktopMediaQuery();
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        nextFrame += 1;
        frames.set(nextFrame, callback);
        return nextFrame;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((frame: number) => frames.delete(frame)),
    );
    const searchListener = vi.fn();
    document.addEventListener('keydown', searchListener);
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    const focus = vi.spyOn(trigger, 'focus');

    fireEvent.click(screen.getByRole('button', { name: 'Search docs' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(frames.size).toBe(1);

    crossToDesktop();
    act(() => {
      for (const callback of frames.values()) callback(16);
    });

    expect(focus).not.toHaveBeenCalled();
    expect(searchListener).not.toHaveBeenCalled();
    document.removeEventListener('keydown', searchListener);
  });

  it('makes the top navigation and site content inert only while the drawer is open', async () => {
    render(
      <>
        <Nav />
        <div id="site-content"><button type="button">Page content</button></div>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    const nav = document.querySelector<HTMLElement>('.nav-bar');
    const siteContent = document.getElementById('site-content');
    if (!nav || !siteContent) throw new Error('Expected modal background surfaces');

    fireEvent.click(trigger);
    expect(nav.inert).toBe(true);
    expect(siteContent.inert).toBe(true);

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close menu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(nav.inert).toBe(false);
    expect(siteContent.inert).toBe(false);
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
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    const { focus, observation } = expectFocusAfterDrawerUnmount(trigger);

    const searchObservation = {
      drawerWasMounted: undefined as boolean | undefined,
      focusedTrigger: undefined as boolean | undefined,
    };
    searchListener.mockImplementation(() => {
      searchObservation.drawerWasMounted = Boolean(
        screen.queryByRole('dialog', { name: 'Mobile navigation' }),
      );
      searchObservation.focusedTrigger = document.activeElement === trigger;
    });

    fireEvent.click(screen.getByRole('button', { name: 'Search docs' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull());
    await waitFor(() => expect(focus).toHaveBeenCalledOnce());
    expect(observation.drawerWasMounted).toBe(false);
    await waitFor(() => expect(searchListener).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'k', metaKey: true }),
    ));
    expect(searchObservation).toEqual({ drawerWasMounted: false, focusedTrigger: true });
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
