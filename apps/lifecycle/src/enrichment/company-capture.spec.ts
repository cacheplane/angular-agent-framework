import { beforeEach, describe, expect, it, vi } from 'vitest';

const { managed } = vi.hoisted(() => ({
  managed: vi.fn(),
}));
vi.mock('./firecrawl.js', () => ({ fetchFirecrawlCompanyEvidence: managed }));

import { createCompanyCapture } from './company-capture.js';

beforeEach(() => {
  managed.mockReset().mockResolvedValue([]);
});

describe('configured company capture', () => {
  it('preserves diagnostics even when logging fails and isolates observer failures', async () => {
    const diagnostic = {
      provider: 'firecrawl' as const,
      outcome: 'captured' as const,
    };
    const observer = vi.fn(() => {
      throw new Error('observer failed');
    });
    const log = vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('log failed');
    });
    managed.mockImplementation(async (_domain, _signal, options) => {
      options.onDiagnostic(diagnostic);
      return [];
    });
    try {
      await expect(
        createCompanyCapture(
          { COMPANY_SCRAPER_SECRET: 'fixture-key' },
          observer
        )('example.com', new AbortController().signal)
      ).resolves.toEqual([]);
      expect(observer).toHaveBeenCalledWith(diagnostic);
    } finally {
      log.mockRestore();
    }
  });
  it('uses Firecrawl without a provider selector', async () => {
    const signal = new AbortController().signal;
    await createCompanyCapture({
      COMPANY_SCRAPER_SECRET: 'fixture-key',
      COMPANY_SCRAPER_URL: 'https://scraper.example.com',
    })('example.com', signal);
    expect(managed).toHaveBeenCalledWith('example.com', signal, {
      secret: 'fixture-key',
      serviceUrl: 'https://scraper.example.com',
      allowLocalHttp: false,
      onDiagnostic: expect.any(Function),
    });
  });
  it('reports configuration failures without logging configuration values', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      await expect(
        createCompanyCapture({})('example.com', new AbortController().signal)
      ).rejects.toThrow('company_capture_missing_key');
      expect(log).toHaveBeenCalledWith('company_capture', {
        provider: 'firecrawl',
        outcome: 'missing_key',
      });
    } finally {
      log.mockRestore();
    }
  });
  it('validates lazily and never falls back on invalid configuration', async () => {
    const capture = createCompanyCapture({});
    await expect(
      capture('example.com', new AbortController().signal)
    ).rejects.toThrow('company_capture_missing_key');
    expect(managed).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])(
    'requires a configured key before calling the provider: %s',
    async (key) => {
      const capture = createCompanyCapture({
        COMPANY_SCRAPER_SECRET: key,
        COMPANY_SCRAPER_URL: 'https://scraper.example.com',
      });
      await expect(
        capture('example.com', new AbortController().signal)
      ).rejects.toThrow('company_capture_missing_key');
      expect(managed).not.toHaveBeenCalled();
    }
  );

  it('preserves provider failures without a second capture attempt', async () => {
    managed.mockRejectedValue(new Error('firecrawl_provider_error'));
    await expect(
      createCompanyCapture({
        COMPANY_SCRAPER_SECRET: 'fixture-key',
        COMPANY_SCRAPER_URL: 'https://scraper.example.com',
      })('example.com', new AbortController().signal)
    ).rejects.toThrow('firecrawl_provider_error');
    expect(managed).toHaveBeenCalledTimes(1);
  });

  it('does not return evidence when cancellation arrives during capture', async () => {
    const controller = new AbortController();
    managed.mockImplementation(async () => {
      controller.abort(new Error('cancelled'));
      return [];
    });
    await expect(
      createCompanyCapture({ COMPANY_SCRAPER_SECRET: 'fixture-key' })(
        'example.com',
        controller.signal
      )
    ).rejects.toThrow('cancelled');
  });
});
