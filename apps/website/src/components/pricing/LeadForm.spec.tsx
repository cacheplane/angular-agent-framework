// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/analytics/client', () => ({ track: trackMock }));

import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { LeadForm } from './LeadForm';

const formPolicy: PublicFormPolicy = {
  mode: 'growth_v1',
  version: 'growth_v1.2026-09-01',
  disclosures: {
    contact: 'By sending, you agree Brian may follow up by email about your request.',
    newsletter: 'Newsletter disclosure',
    whitepaper: 'Whitepaper disclosure',
  },
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function fill(email: string, company = 'Acme'): void {
  fireEvent.change(screen.getByLabelText(/^name$/i), {
    target: { value: 'Buyer' },
  });
  fireEvent.change(screen.getByLabelText(/work email/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(/^company$/i), {
    target: { value: company },
  });
}

function request(): void {
  fireEvent.click(
    screen.getByRole('button', { name: /request enterprise quote/i })
  );
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

describe('LeadForm', () => {
  beforeEach(() => {
    trackMock.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  it('submits and fires the lead analytics with surface/source_section, then shows the sent state', async () => {
    render(<LeadForm formPolicy={formPolicy} />);
    fill('dev@example.com');
    request();

    await waitFor(() => {
      expect(
        screen.getByText(/we'll be in touch within one business day/i)
      ).toBeTruthy();
    });

    expect(trackMock).toHaveBeenCalledWith('marketing:lead_form_submit', {
      surface: 'pricing',
      source_section: 'lead-form',
    });
    expect(trackMock).toHaveBeenCalledWith('marketing:lead_form_success', {
      surface: 'pricing',
      source_section: 'lead-form',
    });
    expect(trackMock).not.toHaveBeenCalledWith(
      'marketing:lead_form_fail',
      expect.anything()
    );
  });

  it('fires the fail event with error_reason api_error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<LeadForm formPolicy={formPolicy} />);
    fill('dev@example.com');
    request();

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    });

    expect(trackMock).toHaveBeenCalledWith('marketing:lead_form_fail', {
      surface: 'pricing',
      source_section: 'lead-form',
      error_reason: 'api_error',
    });
  });

  it('renders the See how Pilot-to-Prod works link pointing at /pilot-to-prod', () => {
    render(<LeadForm formPolicy={formPolicy} />);
    const link = screen.getByRole('link', {
      name: /see how pilot-to-prod works/i,
    });
    expect(link.getAttribute('href')).toBe('/pilot-to-prod');
  });
});

describe('LeadForm growth policy', () => {
  it('renders the contact disclosure and describes the submit control', () => {
    render(<LeadForm formPolicy={formPolicy} />);

    const disclosure = screen.getByText(formPolicy.disclosures.contact);
    const button = screen.getByRole('button', {
      name: /request enterprise quote/i,
    });

    expect(disclosure.id).toBeTruthy();
    expect(button.getAttribute('aria-describedby')).toBe(disclosure.id);
  });

  it('submits the immutable growth envelope declaring the pricing form kind', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<LeadForm formPolicy={formPolicy} />);

    fill('buyer@example.com');
    fireEvent.change(screen.getByLabelText(/team size/i), {
      target: { value: '6-25' },
    });
    request();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/leads');
    const body = sentBody(fetchMock, 0);
    expect(body.form_kind).toBe('pricing');
    expect(body.email).toBe('buyer@example.com');
    expect(body.name).toBe('Buyer');
    expect(body.company).toBe('Acme');
    expect(body.team_size).toBe('6-25');
    expect(body.pilot_interest).toBe('maybe');
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
    render(<LeadForm formPolicy={formPolicy} />);

    fill('buyer@example.com');
    request();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    request();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(sentBody(fetchMock, 1).submission_id).toBe(
      sentBody(fetchMock, 0).submission_id
    );
  });

  it('mints a new submission UUID when the buyer changes the facts', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<LeadForm formPolicy={formPolicy} />);

    fill('buyer@example.com');
    request();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    fill('buyer@example.com', 'Globex');
    request();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(sentBody(fetchMock, 1).submission_id).not.toBe(
      sentBody(fetchMock, 0).submission_id
    );
    expect(sentBody(fetchMock, 1).company).toBe('Globex');
  });

  it('requires a page refresh after a policy mismatch and reports no success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409 })
    );
    render(<LeadForm formPolicy={formPolicy} />);

    fill('buyer@example.com');
    request();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeTruthy()
    );
    expect(screen.queryByText(/we'll be in touch/i)).toBeNull();
  });
});
