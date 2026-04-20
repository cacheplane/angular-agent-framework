// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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

describe('runLicenseCheck', () => {
  let kp: DevKeyPair;
  let validToken: string;
  let warn: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    kp = await generateKeyPair();
    validToken = await signLicense(BASE, kp.privateKey);
    warn = vi.fn();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    __resetNagStateForTests();
    __resetRunLicenseCheckStateForTests();
  });
  afterEach(() => {
    __resetNagStateForTests();
    __resetRunLicenseCheckStateForTests();
  });

  it('does not warn with a valid token and still fires telemetry', async () => {
    const status = await runLicenseCheck({
      package: '@cacheplane/angular',
      version: '1.0.0',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    expect(status).toBe('licensed');
    expect(warn).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.license_id).toBe('cus_abc');
  });

  it('warns when token is missing', async () => {
    const status = await runLicenseCheck({
      package: '@cacheplane/angular',
      version: '1.0.0',
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    expect(status).toBe('missing');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('is idempotent per (package, token) pair', async () => {
    await runLicenseCheck({
      package: '@cacheplane/angular',
      version: '1.0.0',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    await runLicenseCheck({
      package: '@cacheplane/angular',
      version: '1.0.0',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    // Second call is a no-op: no extra warn (already guarded by nag dedupe anyway),
    // and crucially no second telemetry POST.
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('re-runs when token changes (e.g., after key rotation in the host)', async () => {
    const otherToken = await signLicense({ ...BASE, sub: 'cus_xyz' }, kp.privateKey);
    await runLicenseCheck({
      package: '@cacheplane/angular',
      version: '1.0.0',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    await runLicenseCheck({
      package: '@cacheplane/angular',
      version: '1.0.0',
      token: otherToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
