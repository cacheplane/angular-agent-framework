# @threadplane/telemetry

Explicit, opt-in telemetry helpers for Threadplane applications. Installing this
package does not execute telemetry code or make network requests.

<p align="center">
  <a href="https://www.npmjs.com/package/@threadplane/telemetry">
    <img alt="npm version" src="https://img.shields.io/npm/v/@threadplane%2Ftelemetry?color=6C8EFF&labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://angular.dev">
    <img alt="Angular 20 | 21 | 22" src="https://img.shields.io/badge/Angular-20%20%7C%2021%20%7C%2022-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img alt="MIT" src="https://img.shields.io/badge/License-MIT-6C8EFF?labelColor=080B14&style=flat-square" />
  </a>
</p>

## Trust contract

- **Installation is inert.** The package has no install lifecycle scripts.
- **Browser telemetry is opt-in.** It stays disabled unless an application calls
  `provideThreadplaneTelemetry({ enabled: true })`.
- **Node telemetry is explicit.** An event is sent only when application code
  calls a capture helper.
- **Disable controls win.** `TPLANE_TELEMETRY_DISABLED`, `DO_NOT_TRACK`, CI
  detection, or `disableTelemetry()` prevent sends before a network call.

Threadplane telemetry never collects message content, prompts, completions, tool
inputs or outputs, credentials, project paths, raw environment variables, or
personally identifiable information.

## Install

```bash
npm install @threadplane/telemetry
```

Both peer dependencies are optional:

```text
@angular/core    ^20.0.0 || ^21.0.0 || ^22.0.0   # required only for the ./browser Angular service
posthog-js       ^1.372.0                             # required only when using PostHog capture
```

## Node usage

Capture only the events your application chooses:

```ts
import { captureEvent } from '@threadplane/telemetry/node';

await captureEvent('tplane:runtime_instance_created', {
  transport: 'langgraph',
});
```

The runtime adapter helpers exported from `@threadplane/telemetry/node` are
convenience wrappers around the same explicit capture path.

Set `TPLANE_TELEMETRY_INGEST_URL` to route events to an endpoint you control.
The default endpoint is `https://threadplane.ai/api/ingest`.

## Browser usage

```ts
import { provideThreadplaneTelemetry } from '@threadplane/telemetry/browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideThreadplaneTelemetry({
      enabled: true,
      endpoint: '/api/telemetry',
    }),
  ],
};
```

You can also provide a `sink` callback to use your own analytics client. If the
provider is not enabled, browser helpers do nothing.

## Disable controls

Set either `TPLANE_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1`, or call:

```ts
import { disableTelemetry } from '@threadplane/telemetry/node';

disableTelemetry();
```

Common CI environment variables are treated as disabled. Sampling can be set
with `TPLANE_TELEMETRY_SAMPLE_RATE`.

## Anonymous identifiers

- Node identifiers are per-process UUIDs and are not persisted.
- Browser identifiers are per-service-instance UUIDs and are not written to
  cookies or local storage.

## License

MIT. See [LICENSE](../../LICENSE).
