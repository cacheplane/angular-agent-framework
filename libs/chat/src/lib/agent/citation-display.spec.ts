// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  deriveDomain, deriveSourceType, deriveMonogram, monogramHue, formatPublished,
} from './citation-display';
import type { Citation } from './citation';

const c = (over: Partial<Citation>): Citation => ({ id: 'x', index: 1, ...over });

describe('deriveDomain', () => {
  it('strips protocol and leading www.', () => {
    expect(deriveDomain('https://www.rxjs.dev/guide')).toBe('rxjs.dev');
  });
  it('returns null for missing or malformed url', () => {
    expect(deriveDomain(undefined)).toBeNull();
    expect(deriveDomain('not a url')).toBeNull();
  });
});

describe('deriveSourceType', () => {
  it('prefers an explicit sourceType', () => {
    expect(deriveSourceType(c({ sourceType: 'file', url: 'https://a.com' }))).toBe('file');
  });
  it('infers web from an http(s) url', () => {
    expect(deriveSourceType(c({ url: 'https://a.com' }))).toBe('web');
  });
  it('is unknown when neither is present', () => {
    expect(deriveSourceType(c({}))).toBe('unknown');
  });
});

describe('deriveMonogram', () => {
  it('uses the first letter of the domain, uppercased', () => {
    expect(deriveMonogram(c({ url: 'https://angular.dev' }))).toBe('A');
  });
  it('falls back to the title when there is no url', () => {
    expect(deriveMonogram(c({ title: 'zone.js' }))).toBe('Z');
  });
  it('falls back to "?" when nothing usable exists', () => {
    expect(deriveMonogram(c({}))).toBe('?');
  });
});

describe('monogramHue', () => {
  it('is deterministic and within [0,360)', () => {
    const h = monogramHue('rxjs.dev');
    expect(h).toBe(monogramHue('rxjs.dev'));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });
  it('differs for different seeds', () => {
    expect(monogramHue('angular.dev')).not.toBe(monogramHue('rxjs.dev'));
  });
});

describe('formatPublished', () => {
  it('formats a parseable date to "Mon YYYY"', () => {
    expect(formatPublished('2024-04-10')).toMatch(/2024/);
  });
  it('returns null for missing or unparseable values', () => {
    expect(formatPublished(undefined)).toBeNull();
    expect(formatPublished('banana')).toBeNull();
  });
});
