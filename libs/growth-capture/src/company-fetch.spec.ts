import { describe, expect, it, vi } from 'vitest';
import {
  resolveWithNodeDns,
  validatePublicCompanyHostname,
} from './company-fetch.js';

describe('company hostname validation', () => {
  it('cancels outstanding production DNS queries when the request signal aborts', async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const pending = new Promise<string[]>(() => undefined);
    const resolution = resolveWithNodeDns(
      'example.com',
      controller.signal,
      () => ({
        cancel,
        resolve4: vi.fn(() => pending),
        resolve6: vi.fn(() => pending),
      })
    );

    controller.abort(new Error('Dawn cancelled'));

    await expect(resolution).rejects.toThrow(/Dawn cancelled/u);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    ['loopback IPv4', '127.0.0.1'],
    ['private IPv4', '10.0.0.1'],
    ['private IPv4 172', '172.16.0.1'],
    ['private IPv4 192', '192.168.0.1'],
    ['link-local IPv4', '169.254.169.254'],
    ['carrier-grade IPv4', '100.64.0.1'],
    ['documentation IPv4', '192.0.2.1'],
    ['deprecated relay IPv4', '192.88.99.1'],
    ['benchmark IPv4', '198.18.0.1'],
    ['multicast IPv4', '224.0.0.1'],
    ['reserved IPv4', '240.0.0.1'],
    ['unspecified IPv4', '0.0.0.0'],
    ['loopback IPv6', '::1'],
    ['private IPv6', 'fd00::1'],
    ['link-local IPv6', 'fe80::1'],
    ['multicast IPv6', 'ff02::1'],
    ['documentation IPv6', '2001:db8::1'],
    ['retired 6bone IPv6', '3ffe::1'],
    ['documentation IPv6 3fff', '3fff::1'],
    ['reserved ORCHIDv2 IPv6', '2001:20::1'],
    ['unspecified IPv6', '::'],
    ['IPv4-mapped private IPv6', '::ffff:127.0.0.1'],
  ])('rejects %s resolution', async (_label, address) => {
    const resolve = vi.fn().mockResolvedValue([address]);

    await expect(
      validatePublicCompanyHostname(
        'example.com',
        new AbortController().signal,
        resolve
      )
    ).rejects.toThrow(/unsafe address/u);
  });

  it('rejects the whole resolution when any address is unsafe', async () => {
    const resolve = vi.fn().mockResolvedValue(['93.184.216.34', '127.0.0.1']);

    await expect(
      validatePublicCompanyHostname(
        'example.com',
        new AbortController().signal,
        resolve
      )
    ).rejects.toThrow(/unsafe address/u);
  });

  it.each([
    'https://example.com',
    'example.com:8443',
    'user@example.com',
    '127.0.0.1',
    '[::1]',
    'example.com/path',
  ])('rejects an invalid company_domain: %s', async (domain) => {
    const resolve = vi.fn();
    await expect(
      validatePublicCompanyHostname(
        domain,
        new AbortController().signal,
        resolve
      )
    ).rejects.toThrow(/company_domain/u);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('accepts public addresses and normalizes the hostname', async () => {
    const resolve = vi
      .fn()
      .mockResolvedValue(['93.184.216.34', '2606:4700:4700::1111']);
    await expect(
      validatePublicCompanyHostname(
        'Example.COM',
        new AbortController().signal,
        resolve
      )
    ).resolves.toBe('example.com');
  });
});
