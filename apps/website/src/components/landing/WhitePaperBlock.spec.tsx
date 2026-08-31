import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhitePaperBlock } from './WhitePaperBlock';

const trackMock = vi.fn();
vi.mock('../../lib/analytics/client', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return {
    ...mod,
    track: (...args: unknown[]) => trackMock(...args),
    trackWhitepaperDownloadClick: vi.fn(),
  };
});

describe('WhitePaperBlock', () => {
  beforeEach(() => {
    trackMock.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('submits the email, fires signup analytics, and shows the done state', async () => {
    render(<WhitePaperBlock />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'dev@example.com' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /download/i }).closest('form')!);
    await waitFor(() => expect(screen.getByText(/Check your inbox/i)).toBeTruthy());
    const events = trackMock.mock.calls.map((c) => c[0]);
    expect(events).toContain('marketing:whitepaper_signup_submit');
    expect(events).toContain('marketing:whitepaper_signup_success');
  });
});
