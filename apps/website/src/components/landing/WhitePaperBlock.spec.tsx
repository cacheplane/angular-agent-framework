// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/analytics/client', () => ({
  track: trackMock,
  trackWhitepaperDownloadClick: vi.fn(),
}));

import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { WhitePaperBlock } from './WhitePaperBlock';

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

function submit(email: string): void {
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: /download \(free\)/i }));
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WhitePaperBlock', () => {
  beforeEach(() => {
    trackMock.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  it('submits the email, fires signup analytics, and shows the done state', async () => {
    render(<WhitePaperBlock formPolicy={formPolicy} />);
    submit('dev@example.com');

    await waitFor(() =>
      expect(screen.getByText(/Check your inbox/i)).toBeTruthy()
    );
    const events = trackMock.mock.calls.map((call) => call[0]);
    expect(events).toContain('marketing:whitepaper_signup_submit');
    expect(events).toContain('marketing:whitepaper_signup_success');
  });
});

describe('WhitePaperBlock growth policy', () => {
  it('renders the whitepaper disclosure and describes the submit control', () => {
    render(<WhitePaperBlock formPolicy={formPolicy} />);

    const disclosure = screen.getByText(formPolicy.disclosures.whitepaper);
    const button = screen.getByRole('button', { name: /download \(free\)/i });

    expect(disclosure.id).toBeTruthy();
    expect(button.getAttribute('aria-describedby')).toBe(disclosure.id);
  });

  it('submits the immutable growth envelope with the declared paper', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<WhitePaperBlock formPolicy={formPolicy} paper="chat" />);

    submit('reader@example.com');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/whitepaper-signup');
    const body = sentBody(fetchMock, 0);
    expect(body.email).toBe('reader@example.com');
    expect(body.paper).toBe('chat');
    expect(body.policy_version).toBe(formPolicy.version);
    expect(body.submission_id).toMatch(UUID_V4);
    expect(body.acquisition_session_id).toMatch(UUID_V4);
  });

  it('reuses the submission UUID when an uncertain attempt is retried', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<WhitePaperBlock formPolicy={formPolicy} />);

    submit('reader@example.com');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: /download \(free\)/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(sentBody(fetchMock, 1).submission_id).toBe(
      sentBody(fetchMock, 0).submission_id
    );
  });

  it('mints a new submission UUID when the reader changes the facts', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<WhitePaperBlock formPolicy={formPolicy} />);

    submit('reader@example.com');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    submit('someone-else@example.com');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(sentBody(fetchMock, 1).submission_id).not.toBe(
      sentBody(fetchMock, 0).submission_id
    );
  });

  it('requires a page refresh after a policy mismatch and reports no success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409 })
    );
    render(<WhitePaperBlock formPolicy={formPolicy} />);

    submit('reader@example.com');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeTruthy()
    );
    expect(screen.queryByText(/check your inbox/i)).toBeNull();
  });
});
