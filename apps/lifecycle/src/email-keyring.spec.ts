import { describe, expect, it } from 'vitest';
import { loadEmailHmacKeyring } from './email-keyring.js';

const active = { version: 2, secret: 'a'.repeat(32) };
const environment = {
  GROWTH_EMAIL_HMAC_ACTIVE_VERSION: '2',
  GROWTH_EMAIL_HMAC_ACTIVE_SECRET: active.secret,
};

describe('lifecycle email HMAC configuration', () => {
  it('loads the same active and rotation keys used by collection', () => {
    const previous = [{ version: 1, secret: 'b'.repeat(32) }];
    expect(
      loadEmailHmacKeyring({
        ...environment,
        GROWTH_EMAIL_HMAC_PREVIOUS_KEYS: JSON.stringify(previous),
      })
    ).toEqual({ active, previous });
    expect(loadEmailHmacKeyring(environment)).toEqual({ active });
  });

  it('requires an adequately sized active key when configuration is read', () => {
    expect(() => loadEmailHmacKeyring({})).toThrow(/active secret/);
    expect(() =>
      loadEmailHmacKeyring({
        ...environment,
        GROWTH_EMAIL_HMAC_ACTIVE_SECRET: 'short',
      })
    ).toThrow(/active secret/);
  });

  it.each(['0', '32768', '1.5', 'NaN'])(
    'rejects an invalid active key version %s',
    (version) => {
      expect(() =>
        loadEmailHmacKeyring({
          ...environment,
          GROWTH_EMAIL_HMAC_ACTIVE_VERSION: version,
        })
      ).toThrow(/active version/);
    }
  );

  it('rejects duplicate key versions', () => {
    expect(() =>
      loadEmailHmacKeyring({
        ...environment,
        GROWTH_EMAIL_HMAC_PREVIOUS_KEYS: JSON.stringify([active]),
      })
    ).toThrow(/unique/);
  });

  it('does not expose malformed previous key material in errors', () => {
    const secret = 'private-malformed-key-material';
    let caught: unknown;
    try {
      loadEmailHmacKeyring({
        ...environment,
        GROWTH_EMAIL_HMAC_PREVIOUS_KEYS: secret,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(String(caught)).not.toContain(secret);
    expect(String(caught)).toContain('previous keys are invalid');
  });
});
