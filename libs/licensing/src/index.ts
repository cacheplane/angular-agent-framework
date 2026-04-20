// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export type { LicenseClaims, LicenseTier } from './lib/license-token.js';
export type { VerifyResult, VerifyReason } from './lib/verify-license.js';
export { verifyLicense } from './lib/verify-license.js';
export type { LicenseStatus, EvaluateResult, EvaluateOptions } from './lib/evaluate-license.js';
export { evaluateLicense } from './lib/evaluate-license.js';
export type { EmitNagOptions } from './lib/nag.js';
export { emitNag } from './lib/nag.js';
export type {
  TelemetryEvent,
  TelemetryClient,
  CreateTelemetryClientOptions,
} from './lib/telemetry.js';
export { createTelemetryClient } from './lib/telemetry.js';
export type { RunLicenseCheckOptions } from './lib/run-license-check.js';
export { runLicenseCheck } from './lib/run-license-check.js';
export { LICENSE_PUBLIC_KEY } from './lib/license-public-key.js';
export { inferNoncommercial } from './lib/infer-noncommercial.js';
