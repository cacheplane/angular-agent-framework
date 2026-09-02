# Threadplane lifecycle service

This Node 24 service builds Dawn 0.8.21's supported Hono target and serves it through an app-owned Vercel function. The Vercel adapter requires the exact `LIFECYCLE_SERVICE_SECRET` bearer token on every Dawn path. Dawn route middleware repeats the same check for execution routes.

The service has two database boundaries:

- `DATABASE_URL` is the growth CRM/control-plane database used by `@threadplane-internal/growth`.
- `DAWN_DATABASE_URL` is a separate database or isolated schema/database endpoint used only for Dawn threads, checkpoints, and permission state.

Neither variable falls back to the other. Preview and production must use different Neon resources for both boundaries. Configure no lifecycle secret with a `NEXT_PUBLIC_` prefix.

The app's Vercel project must use `apps/lifecycle` as its root directory, enable access to files outside that directory for the npm/Nx monorepo build, and select Node 24. `npx nx build lifecycle` generates the Dawn Hono artifact, rewrites its generated store binding to `DAWN_DATABASE_URL`, verifies the expected `app.mjs` fetch export, and drives an authenticated local request through the adapter.

Keep `LIFECYCLE_CRON_ENABLED` unset or set to anything other than the exact value `true` until the preview dogfood checklist in `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md` passes. In particular, verify outer auth on all Dawn surfaces, named-thread dispatch, duplicate invocation behavior, recovery pause/resume, cancellation/AbortSignal propagation, and Dawn persistence across fresh instances. Send findings to Dawn task `01a05e2f-7e93-7bd0-af74-f13d5a7719cd` for generalized backport.
