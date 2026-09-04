# @threadplane/telemetry

Explicit capture helpers for applications built with
[Threadplane](https://github.com/cacheplane/angular-agent-framework), the AI
agent UI framework for Angular. Every send is one the application asked for:
this package has no ambient collection path.

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

## How sending works

- **No install lifecycle scripts.** The manifest declares none, so `npm install`
  runs no code from this package.
- **The browser service starts disabled.** It sends nothing until an application
  calls `provideThreadplaneTelemetry({ enabled: true })`.
- **Node capture is explicit.** An event is sent only where application code
  calls a capture helper.
- **Disable controls win.** `TPLANE_TELEMETRY_DISABLED`, `DO_NOT_TRACK`, CI
  detection, or `disableTelemetry()` prevent sends before a network call.
- **Point it anywhere.** `TPLANE_TELEMETRY_INGEST_URL`, or an `endpoint` or
  `sink` on the browser provider, routes events to infrastructure you control.

The event categories, purposes, and retention that apply to Threadplane's own
properties are described at
[threadplane.ai/privacy](https://threadplane.ai/privacy).

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
