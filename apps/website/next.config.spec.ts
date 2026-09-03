import { describe, expect, it } from 'vitest';
import { nextConfig as config } from './next.config';

describe('website next.config rewrites', () => {
  it('exposes posthog-js rewrites under /ingest', async () => {
    expect(typeof config.rewrites).toBe('function');
    const rewrites = await config.rewrites!();
    const list = Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles ?? [];
    const sources = list.map((r: { source: string }) => r.source);
    expect(sources).toContain('/ingest/static/:path*');
    expect(sources).toContain('/ingest/:path*');
    const staticRule = list.find((r: { source: string }) => r.source === '/ingest/static/:path*');
    expect(staticRule.destination).toBe('https://us-assets.i.posthog.com/static/:path*');
    const apiRule = list.find((r: { source: string }) => r.source === '/ingest/:path*');
    expect(apiRule.destination).toBe('https://us.i.posthog.com/:path*');
  });
});

/**
 * The dedicated telemetry docs library is retired in favour of one canonical
 * policy. Delivered links and search results outlive a deletion, so every
 * retired path — both the public routes and the markdown API that mirrors
 * them — has to land somewhere real rather than 404.
 */
describe('website next.config redirects', () => {
  const retired = [
    '/docs/telemetry',
    '/docs/telemetry/:path*',
    '/api/markdown/telemetry',
    '/api/markdown/telemetry/:path*',
  ];

  it('permanently redirects every retired telemetry route to the policy', async () => {
    expect(typeof config.redirects).toBe('function');
    const redirects = await config.redirects!();

    for (const source of retired) {
      const rule = redirects.find(
        (r: { source: string }) => r.source === source
      );
      expect(rule, `missing redirect for ${source}`).toBeTruthy();
      expect(rule.destination).toBe('/privacy');
      expect(rule.permanent).toBe(true);
    }
  });

  it('redirects the exact roots as well as their descendants', async () => {
    const sources = (await config.redirects!()).map(
      (r: { source: string }) => r.source
    );

    for (const base of ['/docs/telemetry', '/api/markdown/telemetry']) {
      expect(sources).toContain(base);
      expect(sources).toContain(`${base}/:path*`);
    }
  });
});
