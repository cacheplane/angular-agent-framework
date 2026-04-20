// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { renderLicenseEmail } from './email.js';

describe('renderLicenseEmail', () => {
  it('includes the token wrapped in BEGIN/END delimiters in the text body', () => {
    const out = renderLicenseEmail({
      tier: 'developer-seat',
      seats: 3,
      token: 'PAYLOAD.SIG',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });

    expect(out.text).toContain('-----BEGIN CACHEPLANE LICENSE-----');
    expect(out.text).toContain('PAYLOAD.SIG');
    expect(out.text).toContain('-----END CACHEPLANE LICENSE-----');
  });

  it('subject includes tier and seat count with plural s for seats > 1', () => {
    const out = renderLicenseEmail({
      tier: 'developer-seat',
      seats: 3,
      token: 't.s',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });
    expect(out.subject).toBe('Your Cacheplane license — developer-seat (3 seats)');
  });

  it('subject uses singular seat for seats === 1', () => {
    const out = renderLicenseEmail({
      tier: 'app-deployment',
      seats: 1,
      token: 't.s',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });
    expect(out.subject).toBe('Your Cacheplane license — app-deployment (1 seat)');
  });

  it('includes ISO 8601 UTC expiry in text body', () => {
    const out = renderLicenseEmail({
      tier: 'developer-seat',
      seats: 1,
      token: 't.s',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });
    expect(out.text).toContain('Expires: 2027-04-20T00:00:00.000Z');
  });

  it('html body wraps the token in a monospace pre block', () => {
    const out = renderLicenseEmail({
      tier: 'developer-seat',
      seats: 1,
      token: 'PAYLOAD.SIG',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });
    expect(out.html).toContain('<pre');
    expect(out.html).toContain('PAYLOAD.SIG');
    expect(out.html).toContain('BEGIN CACHEPLANE LICENSE');
  });
});
