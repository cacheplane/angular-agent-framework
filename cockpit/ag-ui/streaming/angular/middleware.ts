// Vercel edge middleware for the cockpit ag-ui/streaming example.
// See cockpit/ag-ui/interrupts/angular/middleware.ts for the canonical
// commentary — this file mirrors that shape with a different prefix.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { next } from '@vercel/edge';

export const config = {
  matcher: '/agent/:path*',
};

const ALLOWED_ORIGINS = new Set<string>([
  'https://examples.threadplane.ai',
  'https://cockpit.threadplane.ai',
  'http://localhost:4320',
  'http://localhost:4321',
]);

const redis = new Redis({
  url: process.env['UPSTASH_REDIS_REST_URL']!,
  token: process.env['UPSTASH_REDIS_REST_TOKEN']!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(10, '60 s', 10),
  analytics: false,
  prefix: 'ag-ui-dev:streaming',
});

export default async function middleware(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden origin' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  const verdict = await ratelimit.limit(ip);
  if (!verdict.success) {
    return new Response(JSON.stringify({ error: 'rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  const internalToken = process.env['AG_UI_INTERNAL_TOKEN'];
  if (!internalToken) {
    return new Response(JSON.stringify({ error: 'misconfigured: missing internal token' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const headers = new Headers(request.headers);
  headers.set('x-internal-token', internalToken);
  return next({ headers });
}
