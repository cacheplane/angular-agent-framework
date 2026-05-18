import { describe, expect, it } from 'vitest';
import { validateDraft, ValidationError } from './validation';
import type { Draft } from './types';

function baseX(): Draft {
  return { channel: 'x', text: 'hello' };
}

describe('validateDraft (X)', () => {
  it('accepts a minimal valid single-tweet draft', () => {
    expect(() => validateDraft(baseX())).not.toThrow();
  });

  it('rejects when both text and threadParts are set', () => {
    const d: Draft = { channel: 'x', text: 'hi', threadParts: ['a', 'b'] };
    expect(() => validateDraft(d)).toThrow(ValidationError);
    try {
      validateDraft(d);
    } catch (e) {
      expect((e as ValidationError).rule).toBe('exclusive-text-thread');
    }
  });

  it('rejects when neither text nor threadParts is set', () => {
    const d: Draft = { channel: 'x' };
    expect(() => validateDraft(d)).toThrow(/either text or threadParts/i);
  });

  it('rejects text > 280 chars', () => {
    const d: Draft = { channel: 'x', text: 'a'.repeat(281) };
    expect(() => validateDraft(d)).toThrow(/280/);
  });

  it('accepts text of exactly 280 chars', () => {
    const d: Draft = { channel: 'x', text: 'a'.repeat(280) };
    expect(() => validateDraft(d)).not.toThrow();
  });

  it('counts Unicode code points, not bytes, for length', () => {
    // 4-byte UTF-8 emoji is 1 code point. 280 of them = 280 code points.
    const d: Draft = { channel: 'x', text: '🎉'.repeat(280) };
    expect(() => validateDraft(d)).not.toThrow();
  });

  it('rejects threadParts length < 2', () => {
    const d: Draft = { channel: 'x', threadParts: ['only one'] };
    expect(() => validateDraft(d)).toThrow(/at least 2/i);
  });

  it('rejects any threadParts[i] > 280 chars', () => {
    const d: Draft = { channel: 'x', threadParts: ['ok', 'a'.repeat(281)] };
    expect(() => validateDraft(d)).toThrow(/280/);
  });

  it('rejects > 4 media', () => {
    const m = { png: Buffer.from('a'), alt: 'x' };
    const d: Draft = { channel: 'x', text: 'hi', media: [m, m, m, m, m] };
    expect(() => validateDraft(d)).toThrow(/at most 4 media/i);
  });

  it('rejects empty alt text', () => {
    const d: Draft = {
      channel: 'x',
      text: 'hi',
      media: [{ png: Buffer.from('a'), alt: '' }],
    };
    expect(() => validateDraft(d)).toThrow(/alt text/i);
  });

  it('rejects alt text > 1000 chars', () => {
    const d: Draft = {
      channel: 'x',
      text: 'hi',
      media: [{ png: Buffer.from('a'), alt: 'a'.repeat(1001) }],
    };
    expect(() => validateDraft(d)).toThrow(/1000/);
  });

  it('rejects PNG > 5 MB', () => {
    const d: Draft = {
      channel: 'x',
      text: 'hi',
      media: [{ png: Buffer.alloc(5 * 1024 * 1024 + 1), alt: 'x' }],
    };
    expect(() => validateDraft(d)).toThrow(/5 ?MB/i);
  });

  it('rejects unknown channel for X adapter sanity check', () => {
    const d: Draft = { channel: 'linkedin' as 'x', text: 'hi' };
    expect(() => validateDraft(d, { adapterId: 'x' })).toThrow(/channel mismatch/i);
  });
});

describe('validateDraft (other channels)', () => {
  it('throws not-yet-implemented for linkedin/devto/reddit', () => {
    for (const channel of ['linkedin', 'devto', 'reddit'] as const) {
      const d: Draft = { channel, text: 'hi' };
      expect(() => validateDraft(d)).toThrow(/not yet implemented/i);
    }
  });
});
