# @ngaf/licensing

Offline Ed25519 license verification for the ThreadPlane Angular framework
libraries.

## Status

Private, pre-1.0. Consumed by `@ngaf/langgraph`, `@ngaf/render`, and
`@ngaf/chat`. Not intended as a standalone import.

## Behavior

- `verifyLicense(token, publicKey)` — pure Ed25519 verification, no I/O.
- `evaluateLicense(result, { nowSec })` — returns one of
  `licensed | grace | expired | missing | tampered | noncommercial`.
- `runLicenseCheck(options)` — runs verification and emits a single
  `console.warn` with the `[threadplane]` prefix when unlicensed.
- **Never throws from init** — every failure mode is reported via warn, never
  by throwing or blocking the host application's startup.
