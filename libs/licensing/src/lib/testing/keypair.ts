// SPDX-License-Identifier: MIT
// TEST-ONLY utility: do not export from the package's public index.
import * as ed from '@noble/ed25519';

export interface DevKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export async function generateKeyPair(): Promise<DevKeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}
