// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared test fixtures: helper to produce signed tokens against a freshly
// generated keypair. Not exported from the package's public index.
import { signLicense, generateKeyPair, type DevKeyPair } from './keypair';
import type { LicenseClaims } from '../license-token';

export interface FixturePack {
  kp: DevKeyPair;
  validToken: string;
  expiredToken: string;
  baseClaims: LicenseClaims;
}

export async function buildFixturePack(): Promise<FixturePack> {
  const kp = await generateKeyPair();
  const baseClaims: LicenseClaims = {
    sub: 'cus_fixture',
    tier: 'developer-seat',
    iat: 1_700_000_000,
    exp: 2_000_000_000,
    seats: 1,
  };
  const validToken = await signLicense(baseClaims, kp.privateKey);
  const expiredToken = await signLicense(
    { ...baseClaims, exp: 1_700_100_000 },
    kp.privateKey,
  );
  return { kp, validToken, expiredToken, baseClaims };
}
