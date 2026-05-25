# @threadplane/cockpit-telemetry

Private Nx library. **Not** part of the publishable `@threadplane/*` group — it is consumed only by the cockpit-harness build of the framework's example apps (the 32 Angular examples rendered inside the cockpit iframe).

## What it does

When the parent cockpit shell embeds an example as an iframe, it appends URL params (`cockpit_did`, `cockpit_phk`, `cockpit_cap`, optional `cockpit_host`). The example's `main.cockpit.ts` calls `bootstrapWithCockpitHarness`, which:

1. Reads those params via `readCockpitConfigFromIframe()`.
2. If present, registers `provideCockpitTelemetry(config)` and the service initializes PostHog (memory persistence, parent-provided `distinct_id`) on app bootstrap.
3. Subscribes to optional `CHAT_LIFECYCLE`, `AGENT_LIFECYCLE`, and `RENDER_LIFECYCLE` signals from `@threadplane/chat`, `@threadplane/langgraph`, and `@threadplane/render` and emits `cockpit:*` events.

## No app telemetry by default

The framework ships with **zero telemetry** in user apps. This library only activates inside the cockpit harness. The pristine `main.ts` of each example never imports `posthog-js`. The `browser-silence.spec.ts` test enforces this contract.

See `libs/telemetry/README.md` for the parallel pattern in the public telemetry library.
