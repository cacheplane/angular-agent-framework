import { describe, it, expect, vi } from 'vitest';
import { AIRWORTHINESS } from './preflight-checklist';

describe('airworthiness rows', () => {
  it('lists exactly the five third-party figures', () => {
    // A length pin, on purpose: the list is only as honest as its sources,
    // and a row added without one is the failure mode this guard exists for.
    expect(AIRWORTHINESS.map((r) => r.challenge)).toEqual([
      'Framework rank',
      'OpenSSF Scorecard',
      'Supply-chain grade',
      'Angular support',
      'Release provenance',
    ]);
  });

  it('proves every row it ticks', () => {
    // "Not self-reported" is the section's own aside. A ticked row with no
    // link is a claim with no source.
    for (const row of AIRWORTHINESS) {
      expect(row.href, row.challenge).toBeTruthy();
    }
  });

  it('links pages a human can read, never a raw API', () => {
    for (const row of AIRWORTHINESS) {
      const { hostname, pathname } = new URL(row.href, 'https://threadplane.ai');
      expect(hostname.startsWith('api.'), row.href).toBe(false);
      expect(pathname.startsWith('/api/'), row.href).toBe(false);
    }
  });

  it('keeps the HVTrust grade live rather than hardcoding it', () => {
    // It has flipped grade several times in a month against an A-band floor
    // of 80; a hardcoded number would be wrong on some days.
    const grade = AIRWORTHINESS.find((r) => r.challenge === 'Supply-chain grade');
    expect(grade?.badgeSrc).toBe('https://hvtracker.net/badge/threadplane.svg');
    expect(grade?.response).toBe('');
  });

  it('carries no self-reported rows', () => {
    // Cloud, Signup and VC board were ours to say and linked our own pages
    // (/privacy, /docs/…, /about) — an on-site, relative href is what made
    // them self-reported. A row that proves itself always links off-site.
    for (const row of AIRWORTHINESS) {
      expect(row.href, row.challenge).toMatch(/^https?:\/\//);
      const { hostname } = new URL(row.href);
      expect(['threadplane.ai', 'www.threadplane.ai'], row.href).not.toContain(hostname);
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
