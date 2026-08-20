// SPDX-License-Identifier: MIT
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { normalizePostHogHost, toSafeAnalyticsString } from '@threadplane/telemetry/shared';
import { analyticsEvents, type AnalyticsEventName, type AnalyticsProperties } from './lib/analytics/events';
import { classifyAiCrawler, classifyAiReferrer, shouldEmitCrawlerEvent } from './lib/analytics/ai-traffic';

/**
 * Observe AI crawlers and AI-answer-engine referrals.
 *
 * Google Search Console's Generative AI report has no API, and AI crawlers never
 * run JavaScript — so `instrumentation-client.ts` cannot see either signal. This
 * middleware is the only place we can.
 *
 * Deliberately written against Web-standard APIs only (`fetch`, `NextRequest`,
 * `FetchEvent#waitUntil`) so it behaves identically whether Next runs middleware
 * on the Edge or Node.js runtime. `posthog-node` is intentionally NOT used here:
 * it is a Node library, and the Edge bundle is size-constrained.
 *
 * Capture goes DIRECT to the PostHog ingest host, not through the `/ingest/*`
 * rewrites in `next.config.ts`. Those exist so ad-blockers cannot intercept the
 * browser snippet; routing a server-side capture through them would just make the
 * deployment issue an HTTP request to itself.
 */

/** Best-effort, per-instance dedup state. See `shouldEmitCrawlerEvent`. */
const seenCrawlerKeys = new Set<string>();

function isLocalAnalyticsHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

type PendingCapture = {
  event: AnalyticsEventName;
  distinctId: string;
  properties: AnalyticsProperties;
};

/**
 * Classify the request. Returns the event to capture, or null when this is
 * ordinary human traffic (the overwhelmingly common case — keep it cheap).
 */
export function classifyRequest({
  userAgent,
  referrer,
  path,
  now,
  seen,
}: {
  userAgent: string | null;
  referrer: string | null;
  path: string;
  now: number;
  seen: Set<string>;
}): PendingCapture | null {
  const crawler = classifyAiCrawler(userAgent);
  if (crawler) {
    // A crawler that also carries a referrer is still a crawler — never both.
    if (!shouldEmitCrawlerEvent({ crawler, path, now, seen })) return null;
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
    return {
      event: analyticsEvents.marketingAiReferralVisit,
      distinctId: `ai_referral:${source}`,
      // No user_agent, no referrer URL, no query string: this is a human.
      properties: { ai_source: source, source_page: path },
    };
  }

  return null;
}

async function sendToPostHog(capture: PendingCapture): Promise<void> {
  const token = toSafeAnalyticsString(process.env.NEXT_PUBLIC_POSTHOG_TOKEN, 500);
  if (!token) return;

  const host = normalizePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST);
  try {
    await fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
        event: capture.event,
        distinct_id: capture.distinctId,
        timestamp: new Date().toISOString(),
        properties: {
          ...capture.properties,
          // Anonymous by construction: no person profile is created or updated,
          // and `$ip: null` tells PostHog to skip GeoIP enrichment rather than
          // geolocating our own edge node.
          $process_person_profile: false,
          $ip: null,
          $lib: 'threadplane-website-middleware',
        },
      }),
      // A dropped analytics event is acceptable; a hung request is not.
      signal: AbortSignal.timeout(2000),
      keepalive: true,
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
 * HTML routes only.
 *
 * Excluded, and why:
 * - `api`            — no HTML, and lead/checkout routes already capture server-side.
 * - `_next/static`, `_next/image` — build assets.
 * - `ingest`         — the PostHog proxy rewrites in `next.config.ts`; matching them
 *                      would put middleware in front of our own analytics traffic.
 * - `favicon.ico`, and any final segment containing a `.` — static files, plus
 *   `sitemap.xml`, `robots.txt`, `llms.txt`. (Trade-off: we therefore do not see
 *   crawler hits on `llms.txt`; server logs remain the source for those.)
 * - `opengraph-image` / `twitter-image` — prerendered PNG routes with no extension.
 */
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|ingest|favicon.ico|.*opengraph-image|.*twitter-image|.*\\.[^/]*$).*)'],
};
