# @cacheplane/licensing

Offline Ed25519 license verification + non-blocking telemetry for the Cacheplane
Angular framework libraries.

## Status

Private, pre-1.0. Consumed by `@cacheplane/angular`, `@cacheplane/render`, and
`@cacheplane/chat`. Not intended as a standalone import.

## Behavior

- `verifyLicense(token, publicKey)` — pure Ed25519 verification, no I/O.
- `evaluateLicense(result, { nowSec })` — returns one of
  `licensed | grace | expired | missing | tampered | noncommercial`.
- `runLicenseCheck(options)` — runs verification, emits a single
  `console.warn` with the `[cacheplane]` prefix when unlicensed, and fires a
  non-blocking telemetry POST.
- **Never throws from init** — every failure mode is reported via warn, never
  by throwing or blocking the host application's startup.
- **Opt out of telemetry** — set `CACHEPLANE_TELEMETRY=0` in the environment, or
  `globalThis.CACHEPLANE_TELEMETRY = false`.
