// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { runLicenseCheck, __resetRunLicenseCheckStateForTests } from './run-license-check';
import { __resetNagStateForTests } from './nag';
import { signLicense } from './sign-license';
import { generateKeyPair, type DevKeyPair } from './testing/keypair';
import type { LicenseClaims } from './license-token';

const BASE: LicenseClaims = {
  sub: 'cus_abc',
  tier: 'developer-seat',
  iat: 1_700_000_000,
  exp: 2_000_000_000,
  seats: 1,
};

function mutateSignature(token: string): string {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw new Error('expected compact license token');
  const replacement = signature.startsWith('x') ? 'y' : 'x';
  return `${payload}.${replacement}${signature.slice(1)}`;
}

describe('runLicenseCheck', () => {
  let kp: DevKeyPair;
  let validToken: string;
  let warn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    kp = await generateKeyPair();
    validToken = await signLicense(BASE, kp.privateKey);
    warn = vi.fn();
    __resetNagStateForTests();
    __resetRunLicenseCheckStateForTests();
  });
  afterEach(() => {
    __resetNagStateForTests();
    __resetRunLicenseCheckStateForTests();
    vi.restoreAllMocks();
  });

  it('does not warn with a valid token and does not perform network I/O', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const status = await runLicenseCheck({
      package: '@ngaf/langgraph',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      warn,
    });
    expect(status).toBe('licensed');
    expect(warn).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('warns when token is missing', async () => {
    const status = await runLicenseCheck({
      package: '@ngaf/langgraph',
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      warn,
    });
    expect(status).toBe('missing');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('is idempotent per (package, token) pair', async () => {
    await runLicenseCheck({
      package: '@ngaf/langgraph',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      warn,
    });
    await runLicenseCheck({
      package: '@ngaf/langgraph',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      warn,
    });
    // Second call is a no-op: no extra warn, already guarded by nag dedupe.
    expect(warn).not.toHaveBeenCalled();
  });

  it('re-runs when token changes (e.g., after key rotation in the host)', async () => {
    const tamperedToken = mutateSignature(validToken);
    expect(tamperedToken).not.toBe(validToken);
    const first = await runLicenseCheck({
      package: '@ngaf/langgraph',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      warn,
    });
    const second = await runLicenseCheck({
      package: '@ngaf/langgraph',
      token: tamperedToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      warn,
    });
    expect(first).toBe('licensed');
    expect(second).toBe('tampered');
    expect(warn).toHaveBeenCalledOnce();
  });
});
