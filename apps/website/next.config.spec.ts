// SPDX-License-Identifier: MIT
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
