# Threadplane lifecycle service

This Node 24 service builds Dawn 0.8.21's supported Hono target and serves it through an app-owned Vercel function. The Vercel adapter requires the exact `LIFECYCLE_SERVICE_SECRET` bearer token on every Dawn path. Dawn route middleware repeats the same check for execution routes.

The service has two database boundaries:

- `DATABASE_URL` is the growth CRM/control-plane database used by `@threadplane-internal/growth`.
- `DAWN_DATABASE_URL` is a separate database or isolated schema/database endpoint used only for Dawn threads, checkpoints, and permission state.

Neither variable falls back to the other. Preview and production must use different Neon resources for both boundaries. Configure no lifecycle secret with a `NEXT_PUBLIC_` prefix.

Install/runtime activation has a separate rollout switch: `GROWTH_INSTALL_RUNTIME_HELLO_ENABLED` defaults to `false` and accepts only exact `true` or `false`. Only when it and campaign enrollment are enabled does the existing lifecycle tick resolve linked activations before materializing the campaign cohort. Configure the same server-only `GROWTH_EMAIL_HMAC_ACTIVE_VERSION`, `GROWTH_EMAIL_HMAC_ACTIVE_SECRET`, and optional `GROWTH_EMAIL_HMAC_PREVIOUS_KEYS` used by collection; these keys are read lazily only for enabled activation processing. Existing form and claim enrollment needs no new HMAC configuration while the rollout switch is off. Announcement requests do not run this work or submit email.

Apply migrations 0004–0007 before deploying the backend: contact deletion and campaign authorization use the observation tables even while the activation switch is off. Verify a second migration run applies nothing. For databases with historical deletions, run `npm run growth:observability -- initialize-redactions --limit 100` with the matching collection HMAC keys, passing each returned `nextCursor` as `--cursor` until exhausted, before enabling identity collection or activation.

Deploy backend observation acceptance and bridge resolution with the rollout switch off. Verify the synthetic journey in preview with a controlled recipient and lifecycle's matching HMAC keys, then publish the matching collectors and enable production collection and activation gradually. Preserve the existing enrollment start timestamp, campaign, delivery, and cron controls.

A persisted `install_runtime` enrollment reason selects the existing generic founder sequence immediately, without waiting for an enrichment artifact. All three steps stay generic even if optional research later becomes available. Form and project-claim enrollments retain their existing behavior. The shared delivery authorization, reply/suppression stops, mailbox recovery guard, unsubscribe links, and once-per-contact three-step enrollment remain in force; install-derived eligibility does not verify identity or employment.

Recipient delivery also requires `GROWTH_PUBLIC_ACTION_ORIGIN`, a server-only bare HTTPS origin for the Website deployment that owns `/api/unsubscribe`. In preview, use a dedicated public custom-domain alias for the exact Website preview deployment while keeping generated preview URLs protected; the signed action token is the application-layer authorization. In production, use the canonical Website origin. Paths, query strings, fragments, credentials, and HTTP origins are rejected. The lifecycle service uses this value only to construct opaque, contact-bound unsubscribe action URLs; it never derives the origin from a request or hardcodes the production site.

Set `GROWTH_DATABASE_ENVIRONMENT` to exactly `preview`, `production`, or `test` in every process that handles verified Resend events. A verified webhook whose `environment` provider tag is missing or differs from that value is acknowledged without opening a growth transaction or changing delivery/suppression state.

The app's Vercel project must use `apps/lifecycle` as its root directory, enable access to files outside that directory for the npm/Nx monorepo build, and select Node 24. `npx nx build lifecycle` generates the Dawn Hono artifact, rewrites its generated store binding to `DAWN_DATABASE_URL`, verifies the expected `app.mjs` fetch export, and drives an authenticated local request through the adapter.

Keep `LIFECYCLE_CRON_ENABLED` unset or set to anything other than the exact value `true` until the preview dogfood checklist in `docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md` passes. In particular, verify outer auth on all Dawn surfaces, named-thread dispatch, duplicate invocation behavior, recovery pause/resume, cancellation/AbortSignal propagation, and Dawn persistence across fresh instances. Send findings to Dawn task `01a05e2f-7e93-7bd0-af74-f13d5a7719cd` for generalized backport.

Use [DOGFOOD.md](./DOGFOOD.md) for the provider-free setup, probe, and exact cleanup commands. The harness binds the growth target to a database-owned comment sentinel and binds each authenticated lifecycle health response to Vercel's `VERCEL_DEPLOYMENT_ID`; it also validates lifecycle origins in memory before making requests.
