// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { LICENSE_PUBLIC_KEY_HEX } from './license-public-key.generated';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Ed25519 public key baked into this build of `@cacheplane/licensing`. */
export const LICENSE_PUBLIC_KEY: Uint8Array = hexToBytes(LICENSE_PUBLIC_KEY_HEX);
