# @threadplane/telemetry

Transparent, opt-out anonymous usage telemetry for the Threadplane framework. Isomorphic — a Node path (server adapters, postinstall) and a browser path (Angular DI). This README is the public trust contract; it is linked from package install notices and stays aligned with implementation.

<p align="center">
  <a href="https://www.npmjs.com/package/@threadplane/telemetry">
    <img alt="npm version" src="https://img.shields.io/npm/v/@threadplane%2Ftelemetry?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://angular.dev">
    <img alt="Angular 20+ | 21" src="https://img.shields.io/badge/Angular-20%2B%20%7C%2021-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img alt="MIT" src="https://img.shields.io/badge/License-MIT-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
</p>

## What it does

`@threadplane/telemetry` is the single telemetry surface for all `@threadplane/*` packages. It exists so the project can answer "how is Threadplane being used?" without instrumenting browser bundles that ship to end-users.

- **Node telemetry** — on by default, opt-out. Fires on install and on server-adapter lifecycle events.
- **Browser telemetry** — off by default. Never fires unless the consumer explicitly calls `provideThreadplaneTelemetry({ enabled: true })` in their Angular app.
- **Full opt-out** — one env var or one function call silences everything before any network call occurs.

## What is and is not collected

### Node events (opt-out, on by default)

| Event | What is sent |
|-------|-------------|
| `tplane:postinstall` | Package name, package version, Node version, OS, CPU architecture, package manager name/version, workspace/global install flags when npm exposes them, sample weight. Per-process anonymous id. No project path, no raw environment variables, no dependency tree, no installer IP address. |
| `tplane:runtime_instance_created` | Which transport, which model provider (string), Angular peer version. No API keys, no endpoint hostnames, no user data. |
| `tplane:runtime_request_created` | Transport, request type, provider, model. No prompts, thread IDs, assistant IDs, endpoint URLs, or headers. |
| `tplane:stream_started` | Provider, model name. No prompts, no message content. |
| `tplane:stream_ended` | Provider, model name, duration. No prompts, no completions, no message content. |
| `tplane:stream_errored` | Provider, model name, error class. No prompts, no completions, no message content. |

### Browser events (opt-in, off by default)

Nothing fires unless `provideThreadplaneTelemetry({ enabled: true, ... })` is called in root providers.

| Event | What is sent |
|-------|-------------|
| `tplane:browser_provided` | Telemetry initialized; surface name, sample weight. Anonymous, no user data. |
| `tplane:browser_chat_init` | Chat component initialized; surface name, sample weight. Anonymous, no message content. |

Browser-side runtime lifecycle events (`tplane:runtime_instance_created`, `tplane:runtime_request_created`, `tplane:stream_started`, `tplane:stream_ended`, `tplane:stream_errored`) may also be sent when the app captures them explicitly. Same payload constraints as Node.

### Never collected — by anyone, at any time

- Message content (user prompts, model completions, tool call inputs/outputs).
- Personally identifiable information.
- API keys, vendor credentials, project paths, environment variables.

## Install

```bash
npm install @threadplane/telemetry
```

Both peer dependencies are optional:

```
@angular/core    ^20.0.0 || ^21.0.0   # required only for the ./browser Angular service
posthog-js       ^1.372.0              # required only when using PostHog capture
```

## Opt-out

Node telemetry is on by default. Any one of the following turns it off entirely.

### Environment variables

| Variable | Value | Notes |
|----------|-------|-------|
| `TPLANE_TELEMETRY_DISABLED` | `1` or `true` | Package-level kill-switch |
| `DO_NOT_TRACK` | `1` or `true` | Cross-vendor standard; `npm_config_do_not_track` and `NPM_CONFIG_DO_NOT_TRACK` are also respected |

### CI auto-disable

The following CI environment variables are detected automatically — no configuration needed:

`CI=1`, `GITHUB_ACTIONS=1`, `CONTINUOUS_INTEGRATION=1`, `BUILDKITE=1`, `CIRCLECI=1`

Any of these being set (truthy) is treated as an opt-out.

### Programmatic opt-out

Call `disableTelemetry()` before any other `@threadplane/*` import in your Node process:

```ts
import { disableTelemetry } from '@threadplane/telemetry/node';
disableTelemetry();
```

### Sampling

Default sample rate is **1.0** (100%). Reduce it via:

```bash
TPLANE_TELEMETRY_SAMPLE_RATE=0.1   # sample 10% of events
```

Every event carries a `sample_weight` property so de-sampling at query time works correctly.

### Ingest endpoint override

Redirect all Node telemetry to your own endpoint:

```bash
TPLANE_TELEMETRY_INGEST_URL=https://telemetry.acme-internal.example.com/api/ingest
```

The default ingest (when unset) is a thin proxy at `https://threadplane.ai/api/ingest` that accepts the `@threadplane/telemetry` JSON payload, forwards `tplane:*` events to the project PostHog instance, and does not forward installer IP addresses. Source lives in `apps/website/src/app/api/ingest/`.

## Usage

### Node — server adapters

```ts
import {
  captureRuntimeInstanceCreated,
  captureRuntimeRequestCreated,
  captureStreamStarted,
  captureStreamEnded,
  captureStreamErrored,
  captureEvent,
  capturePostinstall,
  disableTelemetry,
} from '@threadplane/telemetry/node';
```

### Browser — Angular DI

Enable browser telemetry in your Angular root providers:

```ts
// app.config.ts
import { provideThreadplaneTelemetry } from '@threadplane/telemetry/browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideThreadplaneTelemetry({
      enabled: true,
      endpoint: '/api/telemetry', // route through your own backend
    }),
  ],
};
```

You can also pass `sink: async ({ event, properties }) => { ... }` to route events through your own analytics client. Legacy `posthogKey` / `posthogHost` options still work for existing adopters, but new code should prefer `sink` or `endpoint` to keep the API vendor-neutral.

Inject the service directly when you need to capture events:

```ts
import { ThreadplaneTelemetryService } from '@threadplane/telemetry/browser';

@Injectable()
export class MyService {
  private telemetry = inject(ThreadplaneTelemetryService);
}
```

If `provideThreadplaneTelemetry({ enabled: true })` is never called, every telemetry helper in `@threadplane/*` browser packages no-ops. No network calls, ever.

### Shared utilities

```ts
import {
  isTelemetryDisabled,
  getDisableReason,
  getAnonId,
  shouldSample,
  sha256,
} from '@threadplane/telemetry';
```

`getDisableReason()` returns `'DO_NOT_TRACK' | 'TPLANE_TELEMETRY_DISABLED' | 'CI' | null`.

## Reliability and transparency

### Debugging

Inspect payloads locally without sending them:

```bash
DEBUG=tplane:telemetry npm install
```

`tplane:telemetry` is the debug namespace — it is not an event name and is never sent to the ingest endpoint.

### Anonymous id strategy

- Node: per-process UUID (`anon_<uuid>`), regenerated every process boot. No persistence across restarts.
- Browser: ephemeral per-service-instance id (`browser:<uuid>`). Not written to localStorage or cookies.

### Trust test

The `@threadplane/telemetry/browser` unit test suite includes a permanent trust test:

```
test('no posthog-js import when provideThreadplaneTelemetry is never called', ...)
```

If this test ever fails, the trust contract has been violated and the build blocks.

### What is intentionally absent

- Session replay.
- Cross-session identity stitching.
- Heuristic PII detection. Redaction is explicit and config-driven only.
- Default browser writes to any PostHog instance — including the project's — without explicit configuration.

### Reporting a security issue

If you observe telemetry that contradicts this contract, open an issue at https://github.com/cacheplane/angular-agent-framework/issues tagged `security`. It is treated as P0.

## Release cadence

This package follows patch-only releases (`0.0.x`). Even breaking changes increment the patch version at current scale.

## License

MIT. See [LICENSE](../../LICENSE).
