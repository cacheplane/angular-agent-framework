// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Monorepo-internal test helpers. NOT part of the published package —
// excluded from `tsconfig.lib.json` so nothing here ships in dist.
// Downstream consumers cannot import `@cacheplane/licensing/testing`.
export { generateKeyPair, signLicense } from './lib/testing/keypair';
export type { DevKeyPair } from './lib/testing/keypair';
export { __resetRunLicenseCheckStateForTests } from './lib/run-license-check';
export { __resetNagStateForTests } from './lib/nag';
