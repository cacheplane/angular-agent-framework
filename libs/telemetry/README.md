# @ngaf/telemetry

This README is the public trust contract for `@ngaf/*` telemetry. It is linked
from package install notices and should stay aligned with implementation.

## Imports

```typescript
// Browser (Angular DI provider)
import { provideNgafTelemetry } from '@ngaf/telemetry/browser';

// Node (server adapters)
import {
  captureRuntimeInstanceCreated,
  captureStreamStarted,
  captureStreamEnded,
  captureStreamErrored,
  disableTelemetry,
} from '@ngaf/telemetry/node';

// Shared utilities (events, env detection, hashing)
import { isTelemetryDisabled, sha256, getAnonId } from '@ngaf/telemetry';
```

## What this package is

The single telemetry surface for `@ngaf/*`. It exists so we can answer "how is Cacheplane being used?" without instrumenting browser packages that ship to end-users.

## What is and isn't telemetered

**Telemetered by default (Node, opt-out):**
- `ngaf:postinstall` — fires once per dependency/global install of a published `@ngaf/*` package. Properties: package name, package version, Node version, OS, package manager name/version when npm exposes it, sample weight. It uses a per-process anonymous id. No project path, no environment variables, no dependency tree, no installer IP address.
- `ngaf:runtime_instance_created` — server adapters (LangGraph, AG-UI) call this when they spin up. Properties: which transport, which model provider (string), Angular peer version. **No API keys**, no endpoint hostnames, no user data.
- `ngaf:stream_started` / `ngaf:stream_ended` / `ngaf:stream_errored` — per-request lifecycle on server adapters. Properties: provider, model name, duration, error class. No prompts, no completions, no message content.

**Telemetered only on explicit opt-in (Browser):**
- Nothing fires unless the consumer calls `provideNgafTelemetry({ enabled: true, posthogKey, posthogHost })` in their root providers.
- When opted in: `ngaf:browser_provided`, `ngaf:browser_chat_init`. Anonymous, no message content.

**Never telemetered (by anyone, at any time):**
- Message content (user prompts, model completions, tool call inputs/outputs).
- Personally identifiable information beyond `email_domain` on explicit server conversion events on the website.
- API keys, vendor credentials, project paths, environment variables.

## Opt-out

Node telemetry is on by default. Three ways to opt out — any one turns it off.

| Method | How |
|--------|-----|
| Cross-vendor env var | `DO_NOT_TRACK=1` or `DO_NOT_TRACK=true` |
| npm config env var | `npm_config_do_not_track=true` |
| Package env var | `NGAF_TELEMETRY_DISABLED=1` or `NGAF_TELEMETRY_DISABLED=true` |
| Programmatic | `import { disableTelemetry } from '@ngaf/telemetry/node'; disableTelemetry();` before any other `@ngaf/*` import |

CI environments (`CI=true`, `GITHUB_ACTIONS=true`, etc.) are auto-detected and treated as opt-out by default.

Local top-level installs are skipped by default. Dependency installs and global installs are eligible unless opted out.

The postinstall script prints a single line on stdout only when the install ping was actually accepted by the ingest endpoint. The line is suppressed in CI.

To inspect the install payload locally, run with `DEBUG=ngaf:telemetry`.

## Opt-in (browser)

Browser telemetry is **off by default** and never fires from the library itself. To enable in your Angular app:

```bash
npm install posthog-js
```

```ts
// app.config.ts (or wherever you bootstrap)
import { provideNgafTelemetry } from '@ngaf/telemetry/browser';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideNgafTelemetry({
      enabled: true,
      posthogKey: 'phc_yourKey',     // your PostHog project key, never ours
      posthogHost: 'https://us.i.posthog.com',
    }),
  ],
};
```

If you don't call `provideNgafTelemetry({ enabled: true })`, every telemetry helper in `@ngaf/*` browser packages no-ops. No network calls, ever.

## Sampling

- Default sample rate: **1.0** (100%) at current scale.
- Configurable via `NGAF_TELEMETRY_SAMPLE_RATE` env var (Node).
- Every event carries a `sample_weight` property so future de-sampling at query time works correctly.

## Anonymous id strategy

- Per-process UUID (`anon_<uuid>`), regenerated every Node process boot.
- No persistence across restarts. No persistent identifier.
- Browser opt-in uses the consumer's PostHog `distinct_id` per their own configuration — Cacheplane does not manage browser identity.

## Self-hosting

Enterprise users can redirect Node telemetry to their own ingest:

```bash
NGAF_TELEMETRY_INGEST_URL=https://telemetry.acme-internal.example.com/api/ingest
```

Default ingest (when env var is unset) is a thin proxy on the Cacheplane website (`https://cacheplane.dev/api/ingest`) that accepts the `@ngaf/telemetry` JSON payload and forwards `ngaf:*` events to our PostHog project without forwarding installer IP addresses. Source of the proxy lives in `apps/website/src/app/api/ingest/`.

## Verifying telemetry is silent

The `@ngaf/telemetry/browser` unit test suite includes a permanent trust test:

```
test('no network call occurs when provideNgafTelemetry is never called', ...)
```

If this test ever fails, the trust contract has been violated and the build blocks.

## What's intentionally not in this package

- Session replay. (Not in Phase 0–1.)
- Cross-session identity stitching.
- Heuristic PII detection. (Redaction is explicit and config-driven only.)
- Default browser writes to anyone's PostHog instance — including ours — without explicit configuration.

## Reporting an issue

If you observe telemetry that you believe contradicts this contract, please open an issue at https://github.com/cacheplane/angular-agent-framework/issues — security-tagged. We treat it as a P0.
