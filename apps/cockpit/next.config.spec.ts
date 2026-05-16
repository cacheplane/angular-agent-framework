// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { nextConfig as config } from './next.config';

describe('cockpit next.config', () => {
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

  it('attaches CORS headers to /ingest/* responses', async () => {
    expect(typeof config.headers).toBe('function');
    const rules = await config.headers!();
    const ingestRule = rules.find((r: { source: string }) => r.source === '/ingest/:path*');
    expect(ingestRule).toBeDefined();
    const headerKeys = ingestRule.headers.map((h: { key: string }) => h.key);
    expect(headerKeys).toContain('Access-Control-Allow-Origin');
    expect(headerKeys).toContain('Access-Control-Allow-Methods');
    expect(headerKeys).toContain('Access-Control-Allow-Headers');
    expect(headerKeys).toContain('Access-Control-Max-Age');
    const methods = ingestRule.headers.find((h: { key: string }) => h.key === 'Access-Control-Allow-Methods');
    expect(methods.value).toBe('POST, OPTIONS');
  });
});
