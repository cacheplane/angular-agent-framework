// SPDX-License-Identifier: MIT
// Monorepo-internal test helpers. NOT part of the published package —
// excluded from `tsconfig.lib.json` so nothing here ships in dist.
// Downstream consumers cannot import `@ngaf/licensing/testing`.
export { generateKeyPair } from './lib/testing/keypair';
export type { DevKeyPair } from './lib/testing/keypair';
export { signLicense } from './lib/sign-license';
export { __resetRunLicenseCheckStateForTests } from './lib/run-license-check';
export { __resetNagStateForTests } from './lib/nag';
