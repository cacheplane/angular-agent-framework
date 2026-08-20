// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { classifyAiCrawler, classifyAiReferrer, shouldEmitCrawlerEvent } from './ai-traffic';

describe('classifyAiCrawler', () => {
  it.each([
    ['GPTBot/1.2', 'gptbot'],
    ['ClaudeBot/1.0', 'claudebot'],
    ['PerplexityBot/1.0', 'perplexitybot'],
    ['Google-Extended', 'google-extended'],
  ])('classifies %s as %s', (ua, expected) => {
    expect(classifyAiCrawler(ua)).toBe(expected);
  });

  it.each([
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot', 'gptbot'],
    ['Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)', 'oai-searchbot'],
    ['Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)', 'chatgpt-user'],
    ['Mozilla/5.0 (compatible; Claude-Web/1.0)', 'claude-web'],
    ['anthropic-ai', 'anthropic-ai'],
    ['Mozilla/5.0 (compatible; Perplexity-User/1.0)', 'perplexity-user'],
    ['Mozilla/5.0 (compatible; Google-CloudVertexBot/1.0)', 'google-cloudvertexbot'],
    ['Mozilla/5.0 (compatible; Applebot-Extended/0.1)', 'applebot-extended'],
    ['Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)', 'bytespider'],
    ['meta-externalagent/1.1', 'meta-externalagent'],
    ['CCBot/2.0 (https://commoncrawl.org/faq/)', 'ccbot'],
  ])('classifies the full user-agent string %s as %s', (ua, expected) => {
    expect(classifyAiCrawler(ua)).toBe(expected);
  });

  it.each([
    ['Googlebot/2.1'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'],
    [''],
    ['   '],
  ])('returns null for %s', (ua) => {
    expect(classifyAiCrawler(ua)).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(classifyAiCrawler(null)).toBeNull();
    expect(classifyAiCrawler(undefined)).toBeNull();
  });
});

describe('classifyAiReferrer', () => {
  it.each([
    ['https://chatgpt.com/c/abc', 'chatgpt'],
    ['https://www.perplexity.ai/search?q=x', 'perplexity'],
    ['https://claude.ai/chat/1', 'claude'],
    ['https://gemini.google.com/app', 'gemini'],
    ['https://chat.openai.com/c/1', 'chatgpt'],
    ['https://copilot.microsoft.com/chats/1', 'copilot'],
    ['https://you.com/search?q=x', 'you'],
    ['https://CHATGPT.COM/c/abc', 'chatgpt'],
  ])('classifies %s as %s', (referrer, expected) => {
    expect(classifyAiReferrer(referrer)).toBe(expected);
  });

  it.each([
    ['https://www.google.com/search?q=x'],
    [''],
    ['   '],
    ['not a url'],
    ['https://news.ycombinator.com/'],
  ])('returns null for %s', (referrer) => {
    expect(classifyAiReferrer(referrer)).toBeNull();
  });

  it('does not match a lookalike host by substring', () => {
    expect(classifyAiReferrer('https://evil-chatgpt.com.attacker.net/x')).toBeNull();
    expect(classifyAiReferrer('https://claude.ai.attacker.net/x')).toBeNull();
    expect(classifyAiReferrer('https://notclaude.ai/x')).toBeNull();
    expect(classifyAiReferrer('https://attacker.net/?u=https://chatgpt.com/c/1')).toBeNull();
  });

  it('matches subdomains of a known AI host', () => {
    expect(classifyAiReferrer('https://www.chatgpt.com/c/1')).toBe('chatgpt');
    expect(classifyAiReferrer('https://labs.perplexity.ai/')).toBe('perplexity');
  });

  it('ignores non-http schemes', () => {
    expect(classifyAiReferrer('javascript:alert(1)')).toBeNull();
    expect(classifyAiReferrer('android-app://com.openai.chatgpt')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(classifyAiReferrer(null)).toBeNull();
    expect(classifyAiReferrer(undefined)).toBeNull();
  });
});

describe('shouldEmitCrawlerEvent', () => {
  it('emits the first sighting of a crawler/path pair in a bucket', () => {
    const seen = new Set<string>();
    expect(shouldEmitCrawlerEvent({ crawler: 'gptbot', path: '/blog/a', now: 0, seen })).toBe(true);
  });

  it('suppresses a repeat sighting of the same crawler/path within the same bucket', () => {
    const seen = new Set<string>();
    shouldEmitCrawlerEvent({ crawler: 'gptbot', path: '/blog/a', now: 0, seen });
    expect(shouldEmitCrawlerEvent({ crawler: 'gptbot', path: '/blog/a', now: 60_000, seen })).toBe(false);
  });

  it('re-emits once the bucket rolls over', () => {
    const seen = new Set<string>();
    shouldEmitCrawlerEvent({ crawler: 'gptbot', path: '/blog/a', now: 0, seen });
    expect(shouldEmitCrawlerEvent({ crawler: 'gptbot', path: '/blog/a', now: 3_600_000, seen })).toBe(true);
  });

  it('tracks distinct paths and distinct crawlers separately', () => {
    const seen = new Set<string>();
    expect(shouldEmitCrawlerEvent({ crawler: 'gptbot', path: '/a', now: 0, seen })).toBe(true);
    expect(shouldEmitCrawlerEvent({ crawler: 'gptbot', path: '/b', now: 0, seen })).toBe(true);
    expect(shouldEmitCrawlerEvent({ crawler: 'claudebot', path: '/a', now: 0, seen })).toBe(true);
  });

  it('bounds memory by clearing the set when it grows past the cap', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2100; i++) {
      shouldEmitCrawlerEvent({ crawler: 'gptbot', path: `/p/${i}`, now: 0, seen });
    }
    expect(seen.size).toBeLessThanOrEqual(2000);
  });
});
