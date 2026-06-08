// scripts/ag-ui-demo-middleware.ts
// SPDX-License-Identifier: MIT
/**
 * Vercel Node serverless proxy for the examples/ag-ui demo
 * (ag-ui.threadplane.ai). Forwards /agent* to the Railway-hosted
 * ag-ui-langgraph backend with origin allowlist + Upstash rate-limit
 * (fail-open) + X-Internal-Token injection. Bundled by
 * scripts/assemble-ag-ui-demo.ts into functions/api/[[...path]].func.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const RAILWAY_BASE_URL =
  process.env['AG_UI_DEMO_RAILWAY_URL'] ?? 'https://ag-ui-demo-production-e665.up.railway.app';

const ALLOWED_ORIGINS = new Set<string>([
  'https://ag-ui.threadplane.ai',
  'http://localhost:4201',
]);

let ratelimit: Ratelimit | null = null;
function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return null;
  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.tokenBucket(10, '60 s', 10),
    analytics: false,
    prefix: 'ag-ui-demo',
  });
  return ratelimit;
}

interface VercelRequest { method?: string; headers: Record<string, string | string[] | undefined>; body: unknown; url?: string; }
interface VercelResponse { setHeader(k: string, v: string): void; status(c: number): VercelResponse; json(b: unknown): void; write(c: Buffer | string): void; end(): void; }

function header(headers: VercelRequest['headers'], k: string): string | undefined {
  const v = headers[k];
  return Array.isArray(v) ? v[0] : v;
}
function extractIp(headers: VercelRequest['headers']): string {
  const fwd = header(headers, 'x-forwarded-for');
  const first = fwd?.split(',')[0]?.trim();
  return first || header(headers, 'x-real-ip')?.trim() || `anon:${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');

  const origin = header(req.headers, 'origin');
  if (origin) {
    if (!ALLOWED_ORIGINS.has(origin)) { res.status(403).json({ error: 'origin_not_allowed' }); return; }
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'origin');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const internalToken = process.env['AG_UI_INTERNAL_TOKEN'];
  if (!internalToken) { res.status(500).json({ error: 'misconfigured', detail: 'AG_UI_INTERNAL_TOKEN unset' }); return; }

  const u = new URL(req.url ?? '', 'http://placeholder');
  if (!u.pathname.startsWith('/agent')) { res.status(404).json({ error: 'not_found' }); return; }

  const rl = getRatelimit();
  if (rl) {
    const v = await rl.limit(extractIp(req.headers));
    if (!v.success) { res.setHeader('retry-after', '60'); res.status(429).json({ error: 'rate_limit_exceeded' }); return; }
  }

  const upstreamUrl = `${RAILWAY_BASE_URL}${u.pathname}${u.search}`;
  const headers: Record<string, string> = { 'x-internal-token': internalToken };
  const ct = header(req.headers, 'content-type'); if (ct) headers['content-type'] = ct;
  const acc = header(req.headers, 'accept'); if (acc) headers['accept'] = acc;
  let body: string | undefined;
  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    if (!headers['content-type']) headers['content-type'] = 'application/json';
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { method: req.method ?? 'POST', headers, body });
  } catch (err) { res.status(502).json({ error: 'upstream_unreachable', detail: (err as Error).message }); return; }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length'].includes(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
  if (!upstream.body) { res.end(); return; }
  const reader = upstream.body.getReader();
  while (true) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
  res.end();
};
