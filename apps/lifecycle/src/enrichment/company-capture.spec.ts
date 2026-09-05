import { beforeEach, describe, expect, it, vi } from 'vitest';

const { direct, managed } = vi.hoisted(() => ({
  direct: vi.fn(),
  managed: vi.fn(),
}));
vi.mock('./company-fetch.js', () => ({ fetchCompanyEvidence: direct }));
vi.mock('./firecrawl.js', () => ({ fetchFirecrawlCompanyEvidence: managed }));

import { createCompanyCapture } from './company-capture.js';

beforeEach(() => {
  direct.mockReset().mockResolvedValue([]);
  managed.mockReset().mockResolvedValue([]);
});

describe('configured company capture', () => {
  it('reports configuration failures without logging configuration values', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      await expect(
        createCompanyCapture({
          LIFECYCLE_COMPANY_CAPTURE_PROVIDER: 'secret-invalid',
        })('example.com', new AbortController().signal)
      ).rejects.toThrow('company_capture_invalid_provider');
      expect(log).toHaveBeenCalledWith('company_capture', {
        outcome: 'invalid_provider',
      });
      await expect(
        createCompanyCapture({
          LIFECYCLE_COMPANY_CAPTURE_PROVIDER: 'firecrawl',
        })('example.com', new AbortController().signal)
      ).rejects.toThrow('company_capture_missing_key');
      expect(log).toHaveBeenCalledWith('company_capture', {
        provider: 'firecrawl',
        outcome: 'missing_key',
      });
    } finally {
      log.mockRestore();
    }
  });
  it.each([undefined, 'direct'])(
    'keeps %s on direct capture',
    async (provider) => {
      const signal = new AbortController().signal;
      await createCompanyCapture({
        LIFECYCLE_COMPANY_CAPTURE_PROVIDER: provider,
      })('example.com', signal);
      expect(direct).toHaveBeenCalledWith('example.com', signal, {
        onDiagnostic: expect.any(Function),
      });
      expect(managed).not.toHaveBeenCalled();
    }
  );

  it('selects Firecrawl only with explicit configuration', async () => {
    const signal = new AbortController().signal;
    await createCompanyCapture({
      LIFECYCLE_COMPANY_CAPTURE_PROVIDER: 'firecrawl',
      FIRECRAWL_API_KEY: 'fixture-key',
    })('example.com', signal);
    expect(managed).toHaveBeenCalledWith('example.com', signal, {
      apiKey: 'fixture-key',
      onDiagnostic: expect.any(Function),
    });
    expect(direct).not.toHaveBeenCalled();
  });

  it('validates lazily and never falls back on invalid configuration', async () => {
    const capture = createCompanyCapture({
      LIFECYCLE_COMPANY_CAPTURE_PROVIDER: 'invalid-secret-value',
    });
    await expect(
      capture('example.com', new AbortController().signal)
    ).rejects.toThrow('company_capture_invalid_provider');
    expect(direct).not.toHaveBeenCalled();
    expect(managed).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])(
    'requires a configured key before calling the provider: %s',
    async (key) => {
      const capture = createCompanyCapture({
        LIFECYCLE_COMPANY_CAPTURE_PROVIDER: 'firecrawl',
        FIRECRAWL_API_KEY: key,
      });
      await expect(
        capture('example.com', new AbortController().signal)
      ).rejects.toThrow('company_capture_missing_key');
      expect(managed).not.toHaveBeenCalled();
      expect(direct).not.toHaveBeenCalled();
    }
  );

  it('preserves provider failures without a second capture attempt', async () => {
    managed.mockRejectedValue(new Error('firecrawl_provider_error'));
    await expect(
      createCompanyCapture({
        LIFECYCLE_COMPANY_CAPTURE_PROVIDER: 'firecrawl',
        FIRECRAWL_API_KEY: 'fixture-key',
      })('example.com', new AbortController().signal)
    ).rejects.toThrow('firecrawl_provider_error');
    expect(managed).toHaveBeenCalledTimes(1);
    expect(direct).not.toHaveBeenCalled();
  });

  it('does not return evidence when cancellation arrives during capture', async () => {
    const controller = new AbortController();
    direct.mockImplementation(async () => {
      controller.abort(new Error('cancelled'));
      return [];
    });
    await expect(
      createCompanyCapture({})('example.com', controller.signal)
    ).rejects.toThrow('cancelled');
  });
});
