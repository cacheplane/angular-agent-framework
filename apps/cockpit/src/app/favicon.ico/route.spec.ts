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
    expect(response.headers.get('location')).toBe(
      'https://cockpit.test/icon.svg'
    );
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(capabilityResolver).not.toHaveBeenCalled();
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
