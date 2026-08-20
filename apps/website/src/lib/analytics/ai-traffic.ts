// SPDX-License-Identifier: MIT
/**
 * Pure classification helpers for AI crawler traffic and AI-engine referrals.
 *
 * Deliberately dependency-free and free of any Next.js / Node imports so it can
 * run unchanged in middleware (Edge or Node runtime) and be unit-tested directly.
 *
 * Google Search Console's Generative AI report is UI-only — there is no API for
 * AI Overviews / AI Mode impressions — and AI crawlers never execute JavaScript,
 * so the client-side PostHog snippet cannot see them. Edge middleware is the only
 * place we can observe either signal.
 */

/**
 * User-agent tokens published by AI crawlers, mapped to the stable slug we report.
 *
 * Matched case-insensitively as substrings of the full UA string. Tokens are
 * chosen to be specific enough that non-AI crawlers do not collide: plain
 * `Googlebot` and plain `Applebot` are classic search crawlers and must NOT be
 * classified here — only their AI-training variants (`Google-Extended`,
 * `Applebot-Extended`) count.
 */
const AI_CRAWLER_TOKENS = [
  // OpenAI
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  // Anthropic
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  // Perplexity
  'PerplexityBot',
  'Perplexity-User',
  // Google (AI-specific variants only)
  'Google-Extended',
  'Google-CloudVertexBot',
  // Apple (AI-training variant only)
  'Applebot-Extended',
  // ByteDance / Meta / Common Crawl
  'Bytespider',
  'Meta-ExternalAgent',
  'CCBot',
] as const;

/**
 * Longest token first so a shorter token can never shadow a more specific one
 * (e.g. a hypothetical `Claude` before `Claude-Web`).
 */
const CRAWLER_MATCHERS: ReadonlyArray<{ needle: string; slug: string }> = [...AI_CRAWLER_TOKENS]
  .sort((a, b) => b.length - a.length)
  .map((token) => ({ needle: token.toLowerCase(), slug: token.toLowerCase() }));

/**
 * Registered hostnames of AI answer engines, mapped to the stable source slug.
 *
 * Matched on the *parsed hostname*, exactly or as a subdomain — never as a naive
 * substring, so `evil-chatgpt.com.attacker.net` and `claude.ai.attacker.net` do
 * not classify.
 */
const AI_REFERRER_HOSTS: ReadonlyArray<{ host: string; slug: string }> = [
  { host: 'chatgpt.com', slug: 'chatgpt' },
  { host: 'chat.openai.com', slug: 'chatgpt' },
  { host: 'perplexity.ai', slug: 'perplexity' },
  { host: 'claude.ai', slug: 'claude' },
  { host: 'gemini.google.com', slug: 'gemini' },
  { host: 'copilot.microsoft.com', slug: 'copilot' },
  { host: 'you.com', slug: 'you' },
];

/** Identify an AI crawler from a raw User-Agent header. Returns a stable slug or null. */
export function classifyAiCrawler(userAgent: string | null | undefined): string | null {
  if (typeof userAgent !== 'string') return null;
  const ua = userAgent.trim().toLowerCase();
  if (!ua) return null;

  for (const { needle, slug } of CRAWLER_MATCHERS) {
    if (ua.includes(needle)) return slug;
  }
  return null;
}

/** Identify an AI answer engine from a raw Referer header. Returns a stable slug or null. */
export function classifyAiReferrer(referrer: string | null | undefined): string | null {
  if (typeof referrer !== 'string') return null;
  const value = referrer.trim();
  if (!value) return null;

  let hostname: string;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
  if (!hostname) return null;

  for (const { host, slug } of AI_REFERRER_HOSTS) {
    if (hostname === host || hostname.endsWith(`.${host}`)) return slug;
  }
  return null;
}

/**
 * Dedup window length. Buckets are fixed wall-clock slices, not a sliding
 * window, so a hit at 10:59 and another at 11:01 both emit. That is fine for a
 * "who is reading us" signal — the guarantee is "at most a handful per
 * crawler/path per hour", not "exactly one".
 */
const CRAWLER_BUCKET_MS = 60 * 60 * 1000;

/**
 * Cap on remembered keys. Reached only by a crawler sweeping thousands of
 * distinct URLs in one hour on one instance; clearing then just re-opens the
 * window, which is the safe direction (over-report, never leak memory).
 */
const CRAWLER_SEEN_MAX = 2000;

/**
 * Best-effort, per-instance dedup so a crawler looping a single URL cannot turn
 * into a PostHog firehose.
 *
 * This alone is NOT an abuse ceiling: it is keyed on crawler+path, so varying
 * the path defeats it entirely. `takeEmissionToken` is the actual bound; this
 * just removes the most common source of pointless duplicates.
 *
 * Serverless instances are short-lived and horizontally scaled, so this
 * deliberately does NOT guarantee exactly-once across the fleet — it trims the
 * tail. Under-count is acceptable for this signal; a hung request is not.
 */
export function shouldEmitCrawlerEvent({
  crawler,
  path,
  now,
  seen,
}: {
  crawler: string;
  path: string;
  now: number;
  seen: Set<string>;
}): boolean {
  const bucket = Math.floor(now / CRAWLER_BUCKET_MS);
  // JSON encoding, not string concatenation: a path may legitimately contain
  // any delimiter we might pick, and a collision would silently drop an event.
  const key = JSON.stringify([bucket, crawler, path]);
  if (seen.has(key)) return false;
  if (seen.size >= CRAWLER_SEEN_MAX) seen.clear();
  seen.add(key);
  return true;
}

/**
 * Hard ceiling on TOTAL events emitted by one instance, across every event type
 * and regardless of key variety.
 *
 * Why a total-emission bucket and not just the per-key dedup: both inputs to
 * this feature are attacker-controlled. Anyone can send `Referer:
 * https://chatgpt.com/...` or a `GPTBot` UA against an unlimited number of
 * distinct paths, and without this they could bill the PostHog account
 * arbitrarily or poison the very dataset the feature exists to produce.
 *
 * 500/hour is far above any honest volume: the sitemap is 141 URLs, the dedup
 * already collapses repeats, and a simultaneous full-site sweep by three
 * different crawlers landing entirely on one instance is ~423 events. Real
 * traffic spreads across instances, so the honest path never reaches this.
 * The burst capacity equals the hourly rate, so a legitimate fast sweep is not
 * throttled partway through.
 *
 * Per-instance and therefore best-effort, exactly like the dedup: N instances
 * means the fleet-wide ceiling is N x 500. It bounds the blast radius; it is not
 * a global quota.
 */
export const EMISSION_BUCKET_CAPACITY = 500;
const EMISSION_REFILL_PER_MS = EMISSION_BUCKET_CAPACITY / (60 * 60 * 1000);

export type EmissionBudget = { tokens: number; updatedAt: number };

export function createEmissionBudget(now = 0): EmissionBudget {
  return { tokens: EMISSION_BUCKET_CAPACITY, updatedAt: now };
}

/**
 * Classic token bucket with lazy refill. Returns false once the instance has
 * spent its budget; callers must then drop the event rather than queue it.
 */
export function takeEmissionToken(budget: EmissionBudget, now: number): boolean {
  const elapsed = Math.max(0, now - budget.updatedAt);
  budget.tokens = Math.min(EMISSION_BUCKET_CAPACITY, budget.tokens + elapsed * EMISSION_REFILL_PER_MS);
  budget.updatedAt = now;
  if (budget.tokens < 1) return false;
  budget.tokens -= 1;
  return true;
}
