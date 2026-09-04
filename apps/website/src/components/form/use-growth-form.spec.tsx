// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({ track: trackMock }));

import { analyticsEvents } from '../../lib/analytics/events';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { useGrowthForm } from './use-growth-form';

const formPolicy: PublicFormPolicy = {
  mode: 'growth_v1',
  version: 'growth_v1.2026-09-01',
  disclosures: { contact: 'c', newsletter: 'n', whitepaper: 'w' },
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function options() {
  return {
    route: '/api/leads' as const,
    formPolicy,
    events: {
      submit: analyticsEvents.marketingLeadFormSubmit,
      success: analyticsEvents.marketingLeadFormSuccess,
      fail: analyticsEvents.marketingLeadFormFail,
    },
    analytics: { surface: 'contact' as const, source_section: 'contact-form' },
  };
}

function body(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

beforeEach(() => {
  trackMock.mockClear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('useGrowthForm', () => {
  it('posts the growth envelope, fires submit then success, and lands on sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGrowthForm(options()));
    expect(result.current.status).toBe('idle');

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/leads', expect.objectContaining({ method: 'POST' }));
    const sent = body(fetchMock, 0);
    expect(sent).toMatchObject({ form_kind: 'contact', email: 'jane@acme.com', policy_version: 'growth_v1.2026-09-01' });
    expect(sent.submission_id).toMatch(UUID_V4);
    expect(trackMock).toHaveBeenNthCalledWith(1, 'marketing:lead_form_submit', { surface: 'contact', source_section: 'contact-form' });
    expect(trackMock).toHaveBeenNthCalledWith(2, 'marketing:lead_form_success', { surface: 'contact', source_section: 'contact-form' });
    expect(result.current.status).toBe('sent');
  });

  it('reuses the submission id when the same facts are retried after a server error, then fails with api_error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGrowthForm(options()));

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));
    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));

    expect(body(fetchMock, 0).submission_id).toBe(body(fetchMock, 1).submission_id);
    expect(result.current.status).toBe('failed');
    expect(trackMock).toHaveBeenLastCalledWith('marketing:lead_form_fail', expect.objectContaining({ error_reason: 'api_error' }));
  });

  it('mints a new submission id when the facts change', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGrowthForm(options()));

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));
    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.dev' }));

    expect(body(fetchMock, 0).submission_id).not.toBe(body(fetchMock, 1).submission_id);
  });

  it('goes stale on 409 and reports no success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }));
    const { result } = renderHook(() => useGrowthForm(options()));

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));

    expect(result.current.status).toBe('stale');
    expect(trackMock).not.toHaveBeenCalledWith('marketing:lead_form_success', expect.anything());
  });

  it('fails with network_error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { result } = renderHook(() => useGrowthForm(options()));

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));

    expect(result.current.status).toBe('failed');
    expect(trackMock).toHaveBeenLastCalledWith('marketing:lead_form_fail', expect.objectContaining({ error_reason: 'network_error' }));
  });

  it('is pending while the request is in flight and can be reset', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((r) => { resolve = r; })));
    const { result } = renderHook(() => useGrowthForm(options()));

    let done: Promise<void> = Promise.resolve();
    act(() => { done = result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }); });
    await waitFor(() => expect(result.current.status).toBe('pending'));

    await act(async () => { resolve({ ok: true, status: 200 }); await done; });
    expect(result.current.status).toBe('sent');

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
  });
});
