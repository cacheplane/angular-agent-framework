import { createHmac } from 'node:crypto';

import {
  compareEmailLookupHmac,
  createEmailLookupCandidates,
  createEmailLookupHmac,
  normalizeEmail,
  normalizeRecipientEmail,
  type EmailHmacKeyring,
} from './crypto.ts';

describe('normalizeEmail', () => {
  it('trims and lowercases without applying provider-specific aliases', () => {
    expect(normalizeEmail('  First.Last+Docs@Example.COM  ')).toBe(
      'first.last+docs@example.com'
    );
  });

  it('rejects empty and structurally invalid addresses', () => {
    expect(() => normalizeEmail('   ')).toThrow(/email/i);
    expect(() => normalizeEmail('not-an-address')).toThrow(/email/i);
    expect(() => normalizeEmail('a@@example.com')).toThrow(/email/i);
  });
});

describe('normalizeRecipientEmail', () => {
  it('matches the actual recipient delivery boundary', () => {
    expect(normalizeRecipientEmail('  Reader@Example.COM  ')).toBe(
      'reader@example.com'
    );
  });

  it.each([
    'a@b',
    'a@@example.com',
    'Name <reader@example.com>',
    'reader @example.com',
    `${'a'.repeat(250)}@example.com`,
  ])('rejects an undeliverable recipient address: %s', (email) => {
    expect(() => normalizeRecipientEmail(email)).toThrow(/email/i);
  });
});

describe('private email lookup', () => {
  const keyring: EmailHmacKeyring = {
    active: { version: 3, secret: 'active-secret-with-enough-entropy' },
    previous: [{ version: 2, secret: 'previous-secret-with-enough-entropy' }],
  };

  it('computes versioned HMAC-SHA-256 over the normalized email', () => {
    const lookup = createEmailLookupHmac(
      ' Person@Example.COM ',
      keyring.active
    );
    const expected = createHmac('sha256', keyring.active.secret)
      .update('person@example.com', 'utf8')
      .digest('base64url');

    expect(lookup).toEqual({ digest: expected, keyVersion: 3 });
    expect(lookup.digest).not.toContain('person@example.com');
  });

  it('returns active and previous lookup candidates during rotation', () => {
    const candidates = createEmailLookupCandidates(
      'person@example.com',
      keyring
    );

    expect(candidates.map(({ keyVersion }) => keyVersion)).toEqual([3, 2]);
    expect(candidates[0]).toEqual(
      createEmailLookupHmac('person@example.com', keyring.active)
    );
    const previousKey = keyring.previous?.[0];
    if (!previousKey) throw new Error('Expected a previous test key');
    expect(candidates[1]).toEqual(
      createEmailLookupHmac('person@example.com', previousKey)
    );
  });

  it('rejects duplicate or invalid key versions', () => {
    expect(() =>
      createEmailLookupCandidates('person@example.com', {
        active: { version: 1, secret: 'a'.repeat(32) },
        previous: [{ version: 1, secret: 'b'.repeat(32) }],
      })
    ).toThrow(/version/i);
    expect(() =>
      createEmailLookupHmac('person@example.com', {
        version: 0,
        secret: 's'.repeat(32),
      })
    ).toThrow(/version/i);
  });

  it('requires at least 32 bytes of string or Uint8Array key material', () => {
    expect(() =>
      createEmailLookupHmac('person@example.com', {
        version: 1,
        secret: 'a'.repeat(31),
      })
    ).toThrow(/32 bytes/i);
    expect(() =>
      createEmailLookupHmac('person@example.com', {
        version: 1,
        secret: new Uint8Array(31),
      })
    ).toThrow(/32 bytes/i);
    expect(() =>
      createEmailLookupHmac('person@example.com', {
        version: 1,
        secret: 'é'.repeat(15),
      })
    ).toThrow(/32 bytes/i);

    expect(() =>
      createEmailLookupHmac('person@example.com', {
        version: 1,
        secret: 'a'.repeat(32),
      })
    ).not.toThrow();
    expect(() =>
      createEmailLookupHmac('person@example.com', {
        version: 1,
        secret: new Uint8Array(32),
      })
    ).not.toThrow();
    expect(() =>
      createEmailLookupHmac('person@example.com', {
        version: 1,
        secret: 'é'.repeat(16),
      })
    ).not.toThrow();
  });

  it('compares fixed-width digest bytes and fails closed for malformed lengths', () => {
    const lookup = createEmailLookupHmac('person@example.com', keyring.active);

    expect(compareEmailLookupHmac(lookup.digest, lookup.digest)).toBe(true);
    expect(
      compareEmailLookupHmac(
        lookup.digest,
        createEmailLookupHmac('other@example.com', keyring.active).digest
      )
    ).toBe(false);
    expect(compareEmailLookupHmac(lookup.digest, 'short')).toBe(false);
    expect(compareEmailLookupHmac('short', 'also-short')).toBe(false);
    expect(compareEmailLookupHmac(lookup.digest, `${lookup.digest}=`)).toBe(
      false
    );
  });
});
