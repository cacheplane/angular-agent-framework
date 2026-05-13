import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from './theme-context';
import { ThemeToggle } from './theme-toggle';

// next/navigation is not available in jsdom — provide a mock that the
// component can import.
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockClear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('renders a button reflecting the current theme', () => {
    render(
      <ThemeProvider theme="dark">
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(screen.getByRole('button', { name: /switch to light/i })).toBeTruthy();
  });

  it('POSTs to /api/theme with the next theme on click', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    render(
      <ThemeProvider theme="dark">
        <ThemeToggle />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/theme');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ theme: 'light' });
  });

  it('flips data-theme on documentElement synchronously (optimistic)', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(
      <ThemeProvider theme="dark">
        <ThemeToggle />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('calls router.refresh after persisting the cookie', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(
      <ThemeProvider theme="light">
        <ThemeToggle />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
