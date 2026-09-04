// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/analytics/client', () => ({ track: trackMock }));

import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { ContactForm } from './ContactForm';

const formPolicy: PublicFormPolicy = {
  mode: 'growth_v1',
  version: 'growth_v1.2026-09-01',
  disclosures: {
    contact:
      'By sending, you agree Brian may follow up by email about your request.',
    newsletter: 'Newsletter disclosure',
    whitepaper: 'Whitepaper disclosure',
  },
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function fill(fields: {
  email: string;
  name?: string;
  company?: string;
  message?: string;
}): void {
  fireEvent.change(screen.getByLabelText(/work email/i), {
    target: { value: fields.email },
  });
  if (fields.name !== undefined) {
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: fields.name },
    });
  }
  if (fields.company !== undefined) {
    fireEvent.change(screen.getByLabelText(/company/i), {
      target: { value: fields.company },
    });
  }
  if (fields.message !== undefined) {
    fireEvent.change(screen.getByLabelText(/what are you shipping/i), {
      target: { value: fields.message },
    });
  }
}

function send(): void {
  fireEvent.click(screen.getByRole('button', { name: /send to brian/i }));
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

beforeEach(() => {
  trackMock.mockClear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ContactForm', () => {
  it('submits with email only and fires lead_form_submit + lead_form_success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} />);

    fill({ email: 'jane@acme.com' });
    send();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock, 0).email).toBe('jane@acme.com');
    expect(trackMock).toHaveBeenCalledWith(
      'marketing:lead_form_submit',
      expect.objectContaining({ surface: 'contact' })
    );
    expect(trackMock).toHaveBeenCalledWith(
      'marketing:lead_form_success',
      expect.objectContaining({ surface: 'contact' })
    );
  });

  it('submits with all optional fields populated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} />);

    fill({
      email: 'jane@acme.com',
      name: 'Jane Smith',
      company: 'Acme',
      message: 'Hi',
    });
    send();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock, 0)).toMatchObject({
      email: 'jane@acme.com',
      name: 'Jane Smith',
      company: 'Acme',
      message: 'Hi',
    });
  });

  it('fires lead_form_fail on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );
    render(<ContactForm formPolicy={formPolicy} />);

    fill({ email: 'jane@acme.com' });
    send();

    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith(
        'marketing:lead_form_fail',
        expect.objectContaining({ surface: 'contact' })
      )
    );
  });
});

describe('ContactForm growth policy', () => {
  it('renders the contact disclosure and describes the submit control', () => {
    render(<ContactForm formPolicy={formPolicy} />);

    const disclosure = screen.getByText(formPolicy.disclosures.contact);
    const button = screen.getByRole('button', { name: /send to brian/i });

    expect(disclosure.id).toBeTruthy();
    expect(button.getAttribute('aria-describedby')).toBe(disclosure.id);
  });

  it('submits the immutable growth envelope declaring the contact form kind', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} />);

    fill({ email: 'reader@example.com', name: 'Reader', message: 'Hello' });
    send();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/leads');
    const body = sentBody(fetchMock, 0);
    expect(body.form_kind).toBe('contact');
    expect(body.email).toBe('reader@example.com');
    expect(body.policy_version).toBe(formPolicy.version);
    expect(body.submission_id).toMatch(UUID_V4);
    expect(body.acquisition_session_id).toMatch(UUID_V4);
  });

  it('omits blank optional fields rather than sending undefined facts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} />);

    fill({ email: 'reader@example.com' });
    send();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const keys = Object.keys(sentBody(fetchMock, 0));
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('company');
    expect(keys).not.toContain('message');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('never sends legacy attribution facts the durable boundary ignores', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} />);

    fill({ email: 'reader@example.com' });
    send();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const keys = Object.keys(sentBody(fetchMock, 0));
    for (const legacy of ['source_page', 'track', 'cta_id', 'referrer_host']) {
      expect(keys).not.toContain(legacy);
    }
  });

  it('reuses the submission UUID when an uncertain attempt is retried', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} />);

    fill({ email: 'reader@example.com' });
    send();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    send();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(sentBody(fetchMock, 1).submission_id).toBe(
      sentBody(fetchMock, 0).submission_id
    );
  });

  it('mints a new submission UUID when the sender changes the facts', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} />);

    fill({ email: 'reader@example.com' });
    send();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    fill({ email: 'reader@example.com', message: 'One more thing' });
    send();
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
    render(<ContactForm formPolicy={formPolicy} />);

    fill({ email: 'reader@example.com' });
    send();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeTruthy()
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('validates the email on blur, names the fix, and blocks submit until fixed', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} />);
    const email = screen.getByLabelText(/work email/i);
    fireEvent.change(email, { target: { value: 'jane@acme' } });
    fireEvent.blur(email);
    expect(screen.getByText('Enter a full address, like jordan@acme.dev.')).toBeTruthy();
    send();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(email);
    fireEvent.change(email, { target: { value: 'jane@acme.com' } });
    expect(screen.queryByText('Enter a full address, like jordan@acme.dev.')).toBeNull();
  });

  it('in enterprise intent posts the pricing form kind with the timeline and entry point', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} intent="enterprise" entryPoint="pricing_tier_enterprise" />);

    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'jane@acme.com' } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/timeline/i), { target: { value: 'this_quarter' } });
    fireEvent.change(screen.getByLabelText(/tell us about your use case/i), { target: { value: 'Volume seats.' } });
    fireEvent.click(screen.getByRole('button', { name: /request a conversation/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock, 0)).toMatchObject({
      form_kind: 'pricing',
      email: 'jane@acme.com',
      company: 'Acme',
      timeline: 'this_quarter',
      message: 'Volume seats.',
    });
    expect(trackMock).toHaveBeenCalledWith(
      'marketing:lead_form_submit',
      expect.objectContaining({ surface: 'pricing', entry_point: 'pricing_tier_enterprise' })
    );
  });

  it('in enterprise intent requires a timeline and says so', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<ContactForm formPolicy={formPolicy} intent="enterprise" />);
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'jane@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /request a conversation/i }));
    expect(screen.getByText('Choose a timeline so we can route this.')).toBeTruthy();
  });
});
