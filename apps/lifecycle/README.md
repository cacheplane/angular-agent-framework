# Threadplane lifecycle service

This Node 24 service builds Dawn 0.8.21's supported Hono target and serves it through an app-owned Vercel function. The Vercel adapter requires the exact `LIFECYCLE_SERVICE_SECRET` bearer token on every Dawn path. Dawn route middleware repeats the same check for execution routes.

The service has two database boundaries:

- `DATABASE_URL` is the growth CRM/control-plane database used by `@threadplane-internal/growth`.
- `DAWN_DATABASE_URL` is a separate database or isolated schema/database endpoint used only for Dawn threads, checkpoints, and permission state.

Neither variable falls back to the other. Preview and production must use different Neon resources for both boundaries. Configure no lifecycle secret with a `NEXT_PUBLIC_` prefix.

Recipient delivery also requires `GROWTH_PUBLIC_ACTION_ORIGIN`, a server-only bare HTTPS origin for the Website deployment that owns `/api/unsubscribe`. In preview, use a dedicated public custom-domain alias for the exact Website preview deployment while keeping generated preview URLs protected; the signed action token is the application-layer authorization. In production, use the canonical Website origin. Paths, query strings, fragments, credentials, and HTTP origins are rejected. The lifecycle service uses this value only to construct opaque, contact-bound unsubscribe action URLs; it never derives the origin from a request or hardcodes the production site.

Set `GROWTH_DATABASE_ENVIRONMENT` to exactly `preview`, `production`, or `test` in every process that handles verified Resend events. A verified webhook whose `environment` provider tag is missing or differs from that value is acknowledged without opening a growth transaction or changing delivery/suppression state.

The app's Vercel project must use `apps/lifecycle` as its root directory, enable access to files outside that directory for the npm/Nx monorepo build, and select Node 24. `npx nx build lifecycle` generates the Dawn Hono artifact, rewrites its generated store binding to `DAWN_DATABASE_URL`, verifies the expected `app.mjs` fetch export, and drives an authenticated local request through the adapter.

Keep `LIFECYCLE_CRON_ENABLED` unset or set to anything other than the exact value `true` until the preview dogfood checklist in `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md` passes. In particular, verify outer auth on all Dawn surfaces, named-thread dispatch, duplicate invocation behavior, recovery pause/resume, cancellation/AbortSignal propagation, and Dawn persistence across fresh instances. Send findings to Dawn task `01a05e2f-7e93-7bd0-af74-f13d5a7719cd` for generalized backport.

Use [DOGFOOD.md](./DOGFOOD.md) for the provider-free setup, probe, and exact cleanup commands. The harness binds the growth target to a database-owned comment sentinel and binds each authenticated lifecycle health response to Vercel's `VERCEL_DEPLOYMENT_ID`; it also validates lifecycle origins in memory before making requests.
