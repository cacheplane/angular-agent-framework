import { canonicalJson, publicDigest, identityDigest } from './canonical.ts';

describe('observation digests', () => {
  it('is stable across object key order but detects actual content changes', () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 4 }, b: 2 })
    );
    expect(publicDigest({ a: 1 })).not.toBe(publicDigest({ a: 2 }));
  });
  it('uses the specified historical key and fails closed without it', () => {
    const oldKey = { version: 1, secret: 'a'.repeat(32) };
    const newKey = { version: 2, secret: 'b'.repeat(32) };
    const value = { gitEmail: 'developer@example.invalid' };
    expect(
      identityDigest(value, { active: newKey, previous: [oldKey] }, 1)
    ).toEqual(identityDigest(value, { active: oldKey }));
    expect(identityDigest(value, { active: oldKey })).not.toEqual(
      identityDigest(value, { active: newKey })
    );
    expect(() => identityDigest(value, { active: newKey }, 1)).toThrow(
      'identity_key_unavailable'
    );
  });
});
