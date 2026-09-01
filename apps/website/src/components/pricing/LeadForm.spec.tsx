import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeadForm } from './LeadForm';

const trackMock = vi.fn();
vi.mock('../../lib/analytics/client', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return { ...mod, track: (...args: unknown[]) => trackMock(...args) };
});

describe('LeadForm', () => {
  beforeEach(() => {
    trackMock.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('submits and fires the lead analytics with surface/source_section, then shows the sent state', async () => {
    render(<LeadForm />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Dev' } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'dev@example.com' } });
    fireEvent.change(screen.getByLabelText(/^company$/i), { target: { value: 'Acme' } });
    fireEvent.submit(screen.getByRole('button', { name: /request enterprise quote/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/we'll be in touch within one business day/i)).toBeTruthy();
    });

    expect(trackMock).toHaveBeenCalledWith('marketing:lead_form_submit', {
      surface: 'pricing',
      source_section: 'lead-form',
    });
    expect(trackMock).toHaveBeenCalledWith('marketing:lead_form_success', {
      surface: 'pricing',
      source_section: 'lead-form',
    });
    expect(trackMock).not.toHaveBeenCalledWith('marketing:lead_form_fail', expect.anything());
  });

  it('fires the fail event with error_reason api_error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<LeadForm />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Dev' } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'dev@example.com' } });
    fireEvent.change(screen.getByLabelText(/^company$/i), { target: { value: 'Acme' } });
    fireEvent.submit(screen.getByRole('button', { name: /request enterprise quote/i }).closest('form')!);

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
    render(<LeadForm />);
    const link = screen.getByRole('link', { name: /see how pilot-to-prod works/i });
    expect(link.getAttribute('href')).toBe('/pilot-to-prod');
  });
});
