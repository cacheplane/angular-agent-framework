// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
  trackExternalLinkClick: vi.fn(),
}));

import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { Footer } from './Footer';

const formPolicy: PublicFormPolicy = {
  mode: 'growth_v1',
  version: 'growth_v1.2026-09-01',
  disclosures: {
    contact: 'Contact disclosure',
    newsletter:
      'Subscribe to Threadplane updates and a short, three-email welcome from Brian. Unsubscribe anytime.',
    whitepaper: 'Whitepaper disclosure',
  },
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function subscribe(email: string): void {
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));
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

describe('Footer newsletter growth policy', () => {
  it('renders the exact newsletter disclosure and describes the submit control', () => {
    render(<Footer formPolicy={formPolicy} />);

    const disclosure = screen.getByText(formPolicy.disclosures.newsletter);
    const submit = screen.getByRole('button', { name: /subscribe/i });

    expect(disclosure.compareDocumentPosition(submit)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(submit.getAttribute('aria-describedby')).toBe(disclosure.id);
    expect(disclosure.id).toBeTruthy();
  });

  it('submits the immutable growth envelope with the declared facts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<Footer formPolicy={formPolicy} />);

    subscribe('reader@example.com');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/newsletter');
    const body = sentBody(fetchMock, 0);
    expect(body.email).toBe('reader@example.com');
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
    render(<Footer formPolicy={formPolicy} />);

    subscribe('reader@example.com');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));
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
    render(<Footer formPolicy={formPolicy} />);

    subscribe('reader@example.com');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    subscribe('someone-else@example.com');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(sentBody(fetchMock, 1).submission_id).not.toBe(
      sentBody(fetchMock, 0).submission_id
    );
    expect(sentBody(fetchMock, 1).email).toBe('someone-else@example.com');
  });

  it('requires a page refresh after a policy mismatch and reports no success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409 })
    );
    render(<Footer formPolicy={formPolicy} />);

    subscribe('reader@example.com');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeTruthy()
    );
    expect(screen.queryByText(/subscribed/i)).toBeNull();
  });
});

describe('Footer legal navigation', () => {
  it('links the canonical privacy policy from the bottom bar', () => {
    render(<Footer formPolicy={formPolicy} />);

    expect(
      screen.getByRole('link', { name: /privacy/i }).getAttribute('href')
    ).toBe('/privacy');
  });
});
