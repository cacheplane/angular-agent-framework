import { describe, it, expect, vi } from 'vitest';
import {
  PREFLIGHT_OURS,
  PREFLIGHT_YOURS,
  AIRWORTHINESS,
} from './preflight-checklist';

describe('preflight checklist data', () => {
  it('has the shape the section argues for', () => {
    // The unticked half is the argument, not an oversight — if Yours ever
    // empties out, the section stops making its point.
    expect(PREFLIGHT_OURS).toHaveLength(11);
    expect(PREFLIGHT_YOURS).toHaveLength(8);
    expect(AIRWORTHINESS).toHaveLength(8);
  });

  it('proves every claim it ticks', () => {
    // "Not self-reported" is the section's own aside. A ticked row with no
    // link is a claim with no source.
    for (const row of [...PREFLIGHT_OURS, ...AIRWORTHINESS]) {
      expect(row.href, row.challenge).toBeTruthy();
    }
  });

  it('claims nothing in the Yours column', () => {
    // Nothing proves that YOU set a cost ceiling, so these carry no link.
    for (const row of PREFLIGHT_YOURS) {
      expect(row.href, row.challenge).toBeNull();
    }
  });

  it('links pages a human can read, never a raw API', () => {
    for (const row of [...PREFLIGHT_OURS, ...AIRWORTHINESS]) {
      const { hostname, pathname } = new URL(row.href!, 'https://threadplane.ai');
      expect(hostname.startsWith('api.'), row.href!).toBe(false);
      expect(pathname.startsWith('/api/'), row.href!).toBe(false);
    }
  });

  it('keeps the HVTrust grade live rather than hardcoding it', () => {
    // It has flipped grade several times in a month against an A-band floor
    // of 80; a hardcoded number would be wrong on some days.
    const grade = AIRWORTHINESS.find((r) => r.challenge === 'Supply-chain grade');
    expect(grade?.badgeSrc).toBe('https://hvtracker.net/badge/threadplane.svg');
    expect(grade?.response).toBe('');
  });

  it('gives every response an outcome, not a feature name', () => {
    // Responses are states you could verify. Lowercase would mean someone
    // wrote a sentence instead of a checklist response.
    for (const row of [...PREFLIGHT_OURS, ...PREFLIGHT_YOURS]) {
      expect(row.response, row.challenge).toBe(row.response.toUpperCase());
    }
  });

  it('derives the Angular range rather than hardcoding it', async () => {
    const { WEBSITE_SUPPORTED_ANGULAR_MAJORS } = await import(
      '../components/pricing/angular-support.mjs'
    );
    const row = AIRWORTHINESS.find((r) => r.challenge === 'Angular support');
    expect(row?.response).toContain(String(WEBSITE_SUPPORTED_ANGULAR_MAJORS[0]));
    expect(row?.response).toContain(String(WEBSITE_SUPPORTED_ANGULAR_MAJORS.at(-1)));

    // The assertions above cannot tell a derived "20-22" from a typed one —
    // they agree until someone bumps a major, and by then the homepage has
    // been wrong for a release. So move the dependency and check the value
    // follows it. A hardcoded string will not.
    vi.resetModules();
    vi.doMock('../components/pricing/angular-support.mjs', () => ({
      WEBSITE_SUPPORTED_ANGULAR_MAJORS: Object.freeze([41, 42, 43]),
    }));
    const { AIRWORTHINESS: moved } = await import('./preflight-checklist');
    vi.doUnmock('../components/pricing/angular-support.mjs');
    vi.resetModules();

    expect(moved.find((r) => r.challenge === 'Angular support')?.response).toBe('41–43');
  });
});
