// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/analytics/client', () => ({ track: trackMock }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('?source=home_hero&track=enterprise'),
}));
vi.mock('../ui/Button', () => ({
  Button: ({
    children,
    type,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    type?: 'submit' | 'button' | 'reset';
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

beforeEach(() => {
  trackMock.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(document, 'referrer', {
    value: 'https://cacheplane.ai/pricing',
    configurable: true,
  });
});

describe('ContactForm', () => {
  it('submits with email only and fires lead_form_submit + lead_form_success', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { ContactForm } = await import('./ContactForm');
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'jane@acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.email).toBe('jane@acme.com');
    expect(body.source_page).toBe('home_hero');
    expect(body.track).toBe('enterprise');
    expect(body.referrer_host).toBe('cacheplane.ai');

    expect(trackMock).toHaveBeenCalledWith(
      'marketing:lead_form_submit',
      expect.objectContaining({ surface: 'contact' }),
    );
    expect(trackMock).toHaveBeenCalledWith(
      'marketing:lead_form_success',
      expect.objectContaining({ surface: 'contact' }),
    );
  });

  it('submits with all optional fields populated', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { ContactForm } = await import('./ContactForm');
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@acme.com' } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      email: 'jane@acme.com',
      name: 'Jane Smith',
      company: 'Acme',
      message: 'Hi',
    });
  });

  it('fires lead_form_fail on non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const { ContactForm } = await import('./ContactForm');
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith(
        'marketing:lead_form_fail',
        expect.objectContaining({ surface: 'contact' }),
      ),
    );
  });
});
