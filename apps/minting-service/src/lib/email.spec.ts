// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { renderLicenseEmail, renderRevocationEmail } from './email.js';

describe('renderLicenseEmail', () => {
  it('includes the token wrapped in BEGIN/END delimiters in the text body', () => {
    const out = renderLicenseEmail({
      tier: 'developer_seat',
      seats: 3,
      token: 'PAYLOAD.SIG',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
      stripeCustomerId: 'cus_test',
    });

    expect(out.text).toContain('-----BEGIN THREADPLANE LICENSE-----');
    expect(out.text).toContain('PAYLOAD.SIG');
    expect(out.text).toContain('-----END THREADPLANE LICENSE-----');
  });

  it('uses the public Pro plan name and plural seats in customer-facing copy', () => {
    const out = renderLicenseEmail({
      tier: 'developer_seat',
      seats: 3,
      token: 't.s',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
      stripeCustomerId: 'cus_test',
    });
    expect(out.subject).toBe('Your Threadplane Pro license — 3 seats');
    expect(out.text).toContain('Plan: Pro');
    expect(out.html).toContain('<strong>Plan:</strong> Pro');
    expect(out.subject).not.toContain('developer_seat');
    expect(out.text).not.toContain('developer_seat');
  });

  it('subject uses singular seat for seats === 1', () => {
    const out = renderLicenseEmail({
      tier: 'team',
      seats: 1,
      token: 't.s',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
      stripeCustomerId: 'cus_test',
    });
    expect(out.subject).toBe('Your Threadplane Team license — 1 seat');
  });

  it('includes ISO 8601 UTC expiry in text body', () => {
    const out = renderLicenseEmail({
      tier: 'developer_seat',
      seats: 1,
      token: 't.s',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
      stripeCustomerId: 'cus_test',
    });
    expect(out.text).toContain('Expires: 2027-04-20T00:00:00.000Z');
  });

  it('html body wraps the token in a monospace pre block', () => {
    const out = renderLicenseEmail({
      tier: 'developer_seat',
      seats: 1,
      token: 'PAYLOAD.SIG',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
      stripeCustomerId: 'cus_test',
    });
    expect(out.html).toContain('<pre');
    expect(out.html).toContain('PAYLOAD.SIG');
    expect(out.html).toContain('BEGIN THREADPLANE LICENSE');
  });
});

describe('renderRevocationEmail', () => {
  it('describes the record change without claiming offline signature checks perform revocation lookup', () => {
    const out = renderRevocationEmail({ tier: 'developer_seat' });

    expect(out.text).toContain('Threadplane Pro license');
    expect(out.text).toContain('marked revoked in Threadplane records');
    expect(out.text).toContain('Runtime verification remains offline');
    expect(out.text).not.toContain('fail signature checks');
    expect(out.html).not.toContain('developer_seat');
  });
});
