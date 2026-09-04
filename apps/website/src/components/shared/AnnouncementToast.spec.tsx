import { render, act, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { AnnouncementToast } from './AnnouncementToast';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackWhitepaperDownloadClick: vi.fn(),
}));

const formPolicy: PublicFormPolicy = {
  mode: 'growth_v1',
  version: 'growth_v1.2026-09-01',
  disclosures: {
    contact: 'Contact disclosure',
    newsletter: 'Newsletter disclosure',
    whitepaper:
      'Send me the guide and a short, three-email follow-up from Brian about building with Threadplane. Unsubscribe anytime.',
  },
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function setScroll(fraction: number) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 5000,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  // The threshold denominator is the SCROLLABLE range (scrollHeight - innerHeight),
  // not raw scrollHeight.
  window.scrollY = fraction * (5000 - 1000);
  fireEvent.scroll(window);
}

describe('AnnouncementToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stays hidden after the timer if the reader has not scrolled 40%', () => {
    render(<AnnouncementToast formPolicy={formPolicy} />);
    act(() => vi.advanceTimersByTime(31_000));
    act(() => setScroll(0.1));
    expect(document.querySelector('.toast-root')).toBeNull();
  });

  it('appears once BOTH the timer and the 40% scroll threshold are met', () => {
    render(<AnnouncementToast formPolicy={formPolicy} />);
    act(() => vi.advanceTimersByTime(31_000));
    act(() => setScroll(0.45));
    expect(document.querySelector('.toast-root')).toBeTruthy();
  });

  it('stays dismissed: never reappears once the storage key is set', () => {
    // STORAGE_KEY is not exported from the component; mirrored here from its
    // literal construction: `dismissed-announcement-${ANNOUNCEMENT_DATE}`
    // with ANNOUNCEMENT_DATE = '2026-04-07'.
    localStorage.setItem('dismissed-announcement-2026-04-07', 'true');
    render(<AnnouncementToast formPolicy={formPolicy} />);
    act(() => vi.advanceTimersByTime(31_000));
    act(() => setScroll(0.45));
    expect(document.querySelector('.toast-root')).toBeNull();
  });
});

function openForm(): void {
  render(<AnnouncementToast formPolicy={formPolicy} />);
  act(() => vi.advanceTimersByTime(31_000));
  act(() => setScroll(0.45));
  fireEvent.click(screen.getByRole('button', { name: /get the guide/i }));
}

function fillAndSubmit(email: string): void {
  fireEvent.change(screen.getByLabelText('Work email'), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Get the field report' }));
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

describe('AnnouncementToast growth policy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the whitepaper disclosure and describes the submit control', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    openForm();

    const disclosure = screen.getByText(formPolicy.disclosures.whitepaper);
    const submit = screen.getByRole('button', { name: 'Get the field report' });

    expect(disclosure.id).toBeTruthy();
    expect(submit.getAttribute('aria-describedby')).toBe(disclosure.id);
  });

  it('submits the immutable growth envelope with the declared facts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    openForm();

    fillAndSubmit('reader@example.com');

    await flush();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/whitepaper-signup');
    const body = sentBody(fetchMock, 0);
    expect(body.email).toBe('reader@example.com');
    expect(body.paper).toBe('overview');
    expect(body.policy_version).toBe(formPolicy.version);
    expect(body.submission_id).toMatch(UUID_V4);
    expect(body.acquisition_session_id).toMatch(UUID_V4);
  });

  it('shows the refresh instruction and no success after a policy mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409 })
    );
    openForm();

    fillAndSubmit('reader@example.com');

    await flush();
    expect(screen.getByRole('button', { name: /refresh page/i })).toBeTruthy();
    expect(screen.queryByText(/check your inbox/i)).toBeNull();
  });

  it('reports a failed send instead of pretending it succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    openForm();

    fillAndSubmit('reader@acme.com');

    await flush();
    expect(screen.getByRole('alert').textContent).toContain('That did not send.');
  });

  it('validates on blur and focuses the field on an invalid submit', () => {
    vi.stubGlobal('fetch', vi.fn());
    openForm();

    const input = screen.getByLabelText('Work email');
    fireEvent.click(screen.getByRole('button', { name: 'Get the field report' }));
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'reader@acme' } });
    fireEvent.blur(input);
    expect(screen.getByText('Enter a full address, like jordan@acme.dev.')).toBeTruthy();
  });

  it('shows the sent confirmation on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    openForm();

    fillAndSubmit('reader@example.com');

    await flush();
    expect(screen.getByRole('status').textContent).toContain('Check your inbox.');
  });
});
