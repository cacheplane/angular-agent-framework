# @threadplane/licensing

Browser-safe Ed25519 license-token verification and evaluation — the engine behind `@threadplane/chat`'s commercial-license check.

<p align="center">
  <a href="https://www.npmjs.com/package/@threadplane%2Flicensing">
    <img alt="npm version" src="https://img.shields.io/npm/v/@threadplane%2Flicensing?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img alt="MIT" src="https://img.shields.io/badge/license-MIT-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
</p>

---

## What it does

- Verifies compact Ed25519-signed license tokens offline — no network calls, no server round-trips.
- Evaluates claims against a usage context and returns a structured status (`licensed`, `grace`, `expired`, `missing`, `tampered`, `noncommercial`).
- Emits a single `console.warn` nag when a commercial context lacks a valid license; never throws from initialization.

---

## Install

```bash
npm install @threadplane/licensing
```

**Peer dependencies:**

```bash
npm install @noble/ed25519@^2.2.3
```

---

## Usage

Most consumers do not call this library directly. `@threadplane/chat` calls `runLicenseCheck` internally when you pass `license` to `provideChat({ license: 'your-token' })`.

If you need to verify or evaluate a token yourself:

```typescript
import {
  verifyLicense,
  evaluateLicense,
  LICENSE_PUBLIC_KEY,
} from '@threadplane/licensing';

// Verify the token's Ed25519 signature (async, no network).
const verifyResult = await verifyLicense(myToken, LICENSE_PUBLIC_KEY);

// Evaluate the verified result against the current time.
const { status, claims } = evaluateLicense(verifyResult, {
  nowSec: Math.floor(Date.now() / 1000),
});

// status: 'licensed' | 'grace' | 'expired' | 'missing' | 'tampered' | 'noncommercial'
```

For a full orchestrated check (verify + evaluate + nag in one call):

```typescript
import { runLicenseCheck, LICENSE_PUBLIC_KEY } from '@threadplane/licensing';

const status = await runLicenseCheck({
  package: '@threadplane/chat',
  token: myToken,          // undefined → 'missing' or 'noncommercial'
  publicKey: LICENSE_PUBLIC_KEY,
});
```

---

## API

| Symbol | Kind | Description |
|---|---|---|
| `verifyLicense(token, publicKey)` | `async function` | Verify a signed token; returns `VerifyResult`. |
| `evaluateLicense(verifyResult, options)` | `function` | Evaluate claims against time/context; returns `EvaluateResult`. |
| `runLicenseCheck(options)` | `async function` | Orchestrate verify + evaluate + nag; returns `LicenseStatus`. |
| `emitNag(result, options)` | `function` | Emit a one-time `console.warn` for non-licensed statuses. |
| `signLicense(claims, privateKey)` | `async function` | Sign claims into a token (server / tooling only). |
| `inferNoncommercial()` | `function` | Heuristically determine whether the runtime is noncommercial. |
| `LICENSE_PUBLIC_KEY` | `Uint8Array` | Ed25519 public key for verifying Threadplane tokens. |
| `LicenseTier` | `type` | `'developer_seat' \| 'team' \| 'enterprise'` |
| `LicenseClaims`, `VerifyResult`, `VerifyReason` | `type` | Token payload and verification result shapes. |
| `LicenseStatus`, `EvaluateResult`, `EvaluateOptions` | `type` | Evaluation result and options shapes. |
| `EmitNagOptions`, `RunLicenseCheckOptions` | `type` | Options for `emitNag` and `runLicenseCheck`. |

---

## Reliability

- **Browser-safe** — no Node built-ins (`Buffer`, `process`). Ships into Angular browser bundles without polyfills.
- **Offline** — all verification is done in-process via `@noble/ed25519`; no network calls.
- **Never throws from init** — every failure mode surfaces as a `LicenseStatus` string or a single `console.warn`.
- **Patch-only `0.0.x`** — no breaking version bumps until 1.0.
- CI: Library — lint / test / build.

---

## License

MIT. See [LICENSE](../../LICENSE).
