// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export type { LicenseClaims, LicenseTier } from './lib/license-token';
export type { VerifyResult, VerifyReason } from './lib/verify-license';
export { verifyLicense } from './lib/verify-license';
export type { LicenseStatus, EvaluateResult, EvaluateOptions } from './lib/evaluate-license';
export { evaluateLicense } from './lib/evaluate-license';
export type { EmitNagOptions } from './lib/nag';
export { emitNag } from './lib/nag';
export type {
  TelemetryEvent,
  TelemetryClient,
  CreateTelemetryClientOptions,
} from './lib/telemetry';
export { createTelemetryClient } from './lib/telemetry';
export type { RunLicenseCheckOptions } from './lib/run-license-check';
export { runLicenseCheck } from './lib/run-license-check';
export { LICENSE_PUBLIC_KEY } from './lib/license-public-key';
