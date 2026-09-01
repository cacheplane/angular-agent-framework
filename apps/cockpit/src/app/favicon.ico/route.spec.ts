import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const capabilityResolver = vi.hoisted(() => vi.fn());

vi.mock('../../lib/cockpit-page', () => ({
  getCockpitPageModel: capabilityResolver,
}));

import { GET } from './route';

describe('GET /favicon.ico', () => {
  it('redirects permanently to the same-origin SVG without resolving a capability', () => {
    const response = GET(new Request('https://cockpit.test/favicon.ico'));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/icon.svg');
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(capabilityResolver).not.toHaveBeenCalled();
  });

  it('keeps the redirect relative when the request URL was normalized', () => {
    const response = GET(
      new Request('http://localhost:4319/favicon.ico', {
        headers: { host: '127.0.0.1:4319' },
      })
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/icon.svg');
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
  });

  it('ignores forwarded and malformed origin headers', () => {
    const forwarded = GET(
      new Request('http://localhost:4319/favicon.ico', {
        headers: {
          host: '127.0.0.1:4319',
          'x-forwarded-host': 'cockpit.alias.test:4319',
          'x-forwarded-proto': 'https',
        },
      })
    );
    const malformed = GET(
      new Request('http://localhost:4319/favicon.ico', {
        headers: {
          host: '127.0.0.1:4319/path',
          'x-forwarded-host': 'bad.example/path',
          'x-forwarded-proto': 'javascript',
        },
      })
    );

    expect(forwarded.headers.get('location')).toBe('/icon.svg');
    expect(malformed.headers.get('location')).toBe('/icon.svg');
  });

  it('never incorporates hostile authorities into the redirect', () => {
    const host = GET(
      new Request('http://localhost:4319/favicon.ico', {
        headers: { host: 'attacker.example' },
      })
    );
    const forwarded = GET(
      new Request('http://localhost:4319/favicon.ico', {
        headers: {
          host: 'trusted.example',
          'x-forwarded-host': 'attacker.example',
          'x-forwarded-proto': 'https',
        },
      })
    );

    expect(host.headers.get('location')).toBe('/icon.svg');
    expect(forwarded.headers.get('location')).toBe('/icon.svg');
  });

  it('ships a self-contained accessible Threadplane SVG icon', () => {
    const svg = readFileSync(
      join(
        process.cwd().endsWith('/apps/cockpit')
          ? process.cwd()
          : join(process.cwd(), 'apps/cockpit'),
        'src/app/icon.svg'
      ),
      'utf8'
    );

    expect(svg).toMatch(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('<title>Threadplane Cockpit</title>');
    expect(svg).toContain('#004090');
    expect(svg).toContain('#64C3FD');
    expect(svg).not.toMatch(/<script|xlink:href|\shref=/i);
  });
});
