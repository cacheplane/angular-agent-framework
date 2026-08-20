// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { classifyRequest, config } from './middleware';

const MATCHER = new RegExp(`^${config.matcher[0]}$`);
const matches = (path: string) => MATCHER.test(path);

describe('middleware matcher', () => {
  it.each(['/', '/blog/x', '/docs/chat/overview', '/about', '/llms', '/opengraph'])('matches HTML route %s', (p) => {
    expect(matches(p)).toBe(true);
  });

  it.each([
    '/api/leads',
    '/api/checkout/session',
    '/_next/static/chunk.js',
    '/_next/image',
    '/ingest/e',
    '/ingest/static/array.js',
    '/favicon.ico',
    '/sitemap.xml',
    '/robots.txt',
    '/llms.txt',
    '/opengraph-image',
    '/blog/my-post/opengraph-image',
    '/twitter-image',
    '/whitepapers/overview.pdf',
  ])('excludes %s', (p) => {
    expect(matches(p)).toBe(false);
  });
});

describe('classifyRequest', () => {
  const base = { path: '/blog/a', now: 0 };

  it('captures an AI crawler visit with the path but no query string', () => {
    const capture = classifyRequest({
      ...base,
      userAgent: 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      referrer: null,
      seen: new Set(),
    });
    expect(capture).toEqual({
      event: 'marketing:ai_crawler_visit',
      distinctId: 'ai_crawler:gptbot',
      properties: {
        ai_crawler: 'gptbot',
        source_page: '/blog/a',
        user_agent: 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      },
    });
  });

  it('captures an AI referral visit without the user agent or referrer url', () => {
    const capture = classifyRequest({
      ...base,
      userAgent: 'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0 Safari/537.36',
      referrer: 'https://www.perplexity.ai/search?q=angular+agent',
      seen: new Set(),
    });
    expect(capture).toEqual({
      event: 'marketing:ai_referral_visit',
      distinctId: 'ai_referral:perplexity',
      properties: { ai_source: 'perplexity', source_page: '/blog/a' },
    });
  });

  it('prefers the crawler classification when both match', () => {
    const capture = classifyRequest({
      ...base,
      userAgent: 'ClaudeBot/1.0',
      referrer: 'https://claude.ai/chat/1',
      seen: new Set(),
    });
    expect(capture?.event).toBe('marketing:ai_crawler_visit');
  });

  it('returns null for ordinary human traffic', () => {
    expect(
      classifyRequest({
        ...base,
        userAgent: 'Mozilla/5.0 (Macintosh) Chrome/131.0.0.0 Safari/537.36',
        referrer: 'https://www.google.com/search?q=x',
        seen: new Set(),
      }),
    ).toBeNull();
  });

  it('returns null for a repeat crawler hit on the same path in the same hour', () => {
    const seen = new Set<string>();
    expect(classifyRequest({ ...base, userAgent: 'GPTBot/1.2', referrer: null, seen })).not.toBeNull();
    expect(classifyRequest({ ...base, userAgent: 'GPTBot/1.2', referrer: null, seen })).toBeNull();
  });

  it('truncates an abusive user-agent string', () => {
    const capture = classifyRequest({
      ...base,
      userAgent: `GPTBot/1.2 ${'x'.repeat(5000)}`,
      referrer: null,
      seen: new Set(),
    });
    expect((capture?.properties.user_agent as string).length).toBe(200);
  });
});
