// SPDX-License-Identifier: MIT
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { normalizePostHogHost, toSafeAnalyticsString } from '@threadplane/telemetry/shared';
import { analyticsEvents, type AnalyticsEventName, type AnalyticsProperties } from './lib/analytics/events';
import {
  classifyAiCrawler,
  classifyAiReferrer,
  createEmissionBudget,
  shouldEmitCrawlerEvent,
  takeEmissionToken,
  type EmissionBudget,
} from './lib/analytics/ai-traffic';

/**
 * Observe AI crawlers and AI-answer-engine referrals.
 *
 * Google Search Console's Generative AI report has no API, and AI crawlers never
 * run JavaScript — so `instrumentation-client.ts` cannot see either signal. This
 * middleware is the only place we can.
 *
 * Written against Web-standard APIs only (`fetch`, `NextRequest`,
 * `FetchEvent#waitUntil`) so it behaves identically on the Edge and Node.js
 * runtimes. `posthog-node` is intentionally NOT used: it is a Node library, and
 * this file runs on the Edge runtime.
 *
 * DEFERRED, DELIBERATELY: Next 16 deprecates the `middleware` file convention in
 * favour of `proxy`, so the production build emits a deprecation warning. That
 * warning is known, not overlooked. The rename is NOT cosmetic — a `proxy.ts`
 * always runs on the Node.js runtime, so renaming this file silently moves every
 * request on a public production site from Edge to Node, which has different
 * cold-start and pricing characteristics on Vercel and cannot be validated from
 * a local build. It belongs in its own change with a preview deploy behind it.
 *
 * When that happens the migration is mechanical — `git mv` to `proxy.ts`, rename
 * the `middleware` export to `proxy` — precisely because everything here is
 * Web-standard: `NextProxy` is a type alias for `NextMiddleware`, so the
 * signature and `waitUntil` are unchanged. Verified on a throwaway branch: it
 * works, and it additionally makes `process.env` runtime-read instead of
 * build-inlined (so token rotation would stop needing a redeploy).
 *
 * Capture goes DIRECT to the PostHog ingest host, not through the `/ingest/*`
 * rewrites in `next.config.ts`. Those exist so ad-blockers cannot intercept the
 * browser snippet; routing a server-side capture through them would just make the
 * deployment issue an HTTP request to itself.
 */

/** Best-effort, per-instance dedup + abuse ceiling. See `ai-traffic.ts`. */
const seenCrawlerKeys = new Set<string>();
const emissionBudget = createEmissionBudget(Date.now());

function isLocalAnalyticsHost(hostname: string): boolean {
  // NextUrl#hostname is already unbracketed, so `[::1]` never appears here.
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

type PendingCapture = {
  event: AnalyticsEventName;
  distinctId: string;
  properties: AnalyticsProperties;
};

/**
 * Classify the request. Returns the event to capture, or null when this is
 * ordinary human traffic (the overwhelmingly common case — keep it cheap) or
 * when the instance has exhausted its emission budget.
 */
export function classifyRequest({
  userAgent,
  referrer,
  path,
  now,
  seen,
  budget,
}: {
  userAgent: string | null;
  referrer: string | null;
  path: string;
  now: number;
  seen: Set<string>;
  budget: EmissionBudget;
}): PendingCapture | null {
  const crawler = classifyAiCrawler(userAgent);
  if (crawler) {
    // A crawler that also carries a referrer is still a crawler — never both.
    if (!shouldEmitCrawlerEvent({ crawler, path, now, seen })) return null;
    if (!takeEmissionToken(budget, now)) return null;
    return {
      event: analyticsEvents.marketingAiCrawlerVisit,
      distinctId: `ai_crawler:${crawler}`,
      properties: {
        ai_crawler: crawler,
        source_page: path,
        // Crawler UAs are machine identities, not personal data, and the version
        // suffix is the useful part. Truncated for cardinality safety.
        user_agent: toSafeAnalyticsString(userAgent, 200),
      },
    };
  }

  const source = classifyAiReferrer(referrer);
  if (source) {
    // The referrer header is trivially spoofable by anyone, so this path is the
    // easiest to flood and gets the same ceiling.
    if (!takeEmissionToken(budget, now)) return null;
    return {
      event: analyticsEvents.marketingAiReferralVisit,
      distinctId: `ai_referral:${source}`,
      // No user_agent, no referrer URL, no query string: this is a human.
      properties: { ai_source: source, source_page: path },
    };
  }

  return null;
}

/**
 * The exact wire payload. Split out from `sendToPostHog` so the privacy
 * invariants — no person profile, no GeoIP, no query string, no referrer URL —
 * are directly assertable in tests.
 */
export function buildCapturePayload(capture: PendingCapture, apiKey: string, timestamp: string) {
  return {
    api_key: apiKey,
    event: capture.event,
    distinct_id: capture.distinctId,
    timestamp,
    properties: {
      ...capture.properties,
      // Anonymous by construction: no person profile is created or updated,
      // and `$ip: null` tells PostHog to skip GeoIP enrichment rather than
      // geolocating our own server.
      $process_person_profile: false,
      $ip: null,
      $lib: 'threadplane-website-middleware',
    },
  };
}

export async function sendToPostHog(capture: PendingCapture): Promise<void> {
  const token = toSafeAnalyticsString(process.env.NEXT_PUBLIC_POSTHOG_TOKEN, 500);
  if (!token) return;

  const host = normalizePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST);
  try {
    await fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildCapturePayload(capture, token, new Date().toISOString())),
      // A dropped analytics event is acceptable; a hung request is not.
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Swallow. Analytics must never surface to a visitor.
  }
}

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const response = NextResponse.next();

  try {
    if (
      process.env.NEXT_PUBLIC_POSTHOG_TOKEN &&
      (process.env.NEXT_PUBLIC_POSTHOG_CAPTURE_LOCAL === 'true' || !isLocalAnalyticsHost(request.nextUrl.hostname))
    ) {
      const capture = classifyRequest({
        userAgent: request.headers.get('user-agent'),
        referrer: request.headers.get('referer'),
        // `pathname` only — never the query string, which can carry search terms.
        path: request.nextUrl.pathname,
        now: Date.now(),
        seen: seenCrawlerKeys,
        budget: emissionBudget,
      });

      // Fire-and-forget, but registered with the platform so the runtime keeps the
      // invocation alive past the response instead of killing the promise.
      if (capture) event.waitUntil(sendToPostHog(capture));
    }
  } catch {
    // Never let instrumentation break a page render.
  }

  return response;
}

/**
 * Routes we want to observe.
 *
 * The first entry is HTML pages. The explicit entries after it are the files
 * written FOR AI consumers plus the two strongest crawler-intent signals that
 * exist — a hit on `llms.txt` or `sitemap.xml` is the clearest evidence that an
 * AI engine is reading us, which is the whole point of this instrumentation.
 * They would otherwise be lost to the blunt "has a file extension" rule.
 *
 * Excluded by the first entry, and why:
 * - `api`            — no HTML, and lead/checkout routes already capture server-side.
 * - `_next/static`, `_next/image` — build assets.
 * - `ingest`         — the PostHog proxy rewrites in `next.config.ts`; matching them
 *                      would put this in front of our own analytics traffic.
 * - `favicon.ico`, and any final segment containing a `.` — static files.
 * - `opengraph-image` / `twitter-image` — prerendered PNG routes with no extension.
 *   Anchored to a segment boundary so a page legitimately named
 *   `/my-opengraph-image-guide` is still observed.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|ingest|favicon\\.ico|.*opengraph-image(?:/|$)|.*twitter-image(?:/|$)|.*\\.[^/]*$).*)',
    '/llms.txt',
    '/llms-full.txt',
    '/sitemap.xml',
    '/robots.txt',
  ],
};
