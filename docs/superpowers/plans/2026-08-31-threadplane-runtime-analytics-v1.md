# Threadplane Runtime Analytics V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make runtime analytics default-on only after real product operation, emit five strict value milestones through a hardened first-party gateway, preserve inert package installation/import, and link a project to a person only through an explicit one-time claim.

**Architecture:** `libs/telemetry` owns the closed wire contract, lazy browser/Node project identity, session identity, claim secret, controls, debug mode, and nonblocking first-party transport. Chat supplies the default sink; LangGraph, AG-UI, and Render report semantic success facts through existing lifecycle seams. The website gateway rejects open payloads, registers claim hashes first-write-wins, writes only set-based business projections to Neon, and forwards pseudonymous events to PostHog. Public browser keys and project IDs are attribution, never authentication.

**Tech Stack:** Nx 22, npm workspaces, Angular 21, TypeScript 5.9, Vitest 4, Next.js 16, Neon Postgres, PostHog JS/Node, Linux `strace`, npm/pnpm/Yarn/Bun install fixtures.

**Spec:** `docs/superpowers/specs/2026-08-31-threadplane-growth-lifecycle-v1-design.md` sections E/P0.6–P0.8, P1.3–P1.4, F, H, K–M, and N/PR 5.

**Dependencies:** Requires the lifecycle plan's `libs/growth`, `growth_projects`, `growth_activity`, contact approval transaction, and migrations 0002/0003. The canonical privacy-policy plan must be deployed before default-on capture is enabled. This plan owns migration 0004 and the `/connect` claim flow.

**Merge order and dirty-worktree rule:** Apply the privacy plan first, the lifecycle/control-plane plan second, and this runtime plan third. Before each PR, record `git status --short`; review `git diff -- <owned paths>` and stage only explicit owned paths or hunks. `package-lock.json`, CI files, website files, and PostHog assets may already contain earlier-plan changes and must be extended rather than replaced.

---

## Verified current state and exact seams

- The six release packages (`chat`, `langgraph`, `ag-ui`, `render`, `a2ui`, `telemetry`) currently have no lifecycle hooks, `bin`, Scarf dependency, or install-time analytics. Existing tests inspect manifests, but there is no offline four-manager/network-syscall proof.
- `libs/telemetry` currently exposes open `tplane:*` mechanics, process-memory Node identity, direct public-key PostHog transport, opt-in browser service, and construction/request/start/end/error events.
- `apps/website/src/app/api/ingest/route.ts` accepts any `tplane:` event, arbitrary properties, and caller-controlled `distinctId`; it has no byte limit, claim registration, rate budget, or durable projection.
- `scripts/rate-limit.ts` persists raw IP rows and fails open. It must be migrated for both existing demo and analytics callers.
- Website PostHog currently allows automatic/default capture and `person_profiles: 'always'`; server conversions derive identity from unsalted email hashes/domain/company.
- LangGraph success facts belong in `stream-manager.bridge.ts` around the first decoded event and `finalizeClosedAttempt(...) === 'success'`. Restore-only persistence is the initial `refreshHistory(false)`, not post-run history. Interrupt handling is success after resume, not submission.
- AG-UI connection is first `RUN_STARTED`; completion is successful `RUN_FINISHED`; interrupted/paused/transport-close-only outcomes do not count.
- Render's trustworthy seam is `render-element.component.ts` after `mountedReal` observes a ready registered component. `render-spec.component.ts` `ngOnInit` only proves a wrapper/spec exists.
- `libs/chat/src/lib/agent/runtime-telemetry.ts` is the adapter boundary to retain and narrow; `AgentOptions.telemetry?: sink | false` already exists.

## Locked v1 contract

Every public request has only `event_id`, `event`, `schema_version`, `occurred_at`, `sdk`, `project_id`, optional `project_claim_hash`, `session_id`, and `properties`. Limits: 8 KiB raw body, object depth three, no arrays, UUID IDs, schema version 1, timestamp within ±24 hours, strict SemVer up to 64 characters, SDK name from the six published packages, and a 43-character unpadded base64url SHA-256 claim hash.

Every properties object contains:

```ts
type CommonProperties = {
  transport: 'langgraph' | 'ag-ui' | 'custom';
  surface: 'agent' | 'chat' | 'render';
};
```

The exact discriminated additions are:

```ts
type ActivationPayload =
  | { event: 'transport.connected'; properties: CommonProperties }
  | { event: 'runtime.first_stream_completed'; properties: CommonProperties & { duration_bucket: 'lt_1s' | '1s_to_5s' | '5s_to_30s' | '30s_plus' } }
  | { event: 'thread.persisted'; properties: CommonProperties & { persistence_kind: 'remote_checkpoint' } }
  | { event: 'interrupt.handled'; properties: CommonProperties & { resolution_kind: 'provided' | 'approved' | 'rejected' | 'edited' } }
  | { event: 'generative_ui.rendered'; properties: CommonProperties & { renderer: 'json_render' | 'a2ui' } };
```

Unknown top-level keys, event names, properties, enum values, arrays, and client `$` properties are rejected. The server creates `$insert_id`, `$process_person_profile:false`, `$ip:null`, `received_at`, stored opaque `distinctId`, `identity_state`, `verification:'client_reported'`, and `source:'public_runtime'`. It never forwards the claim hash.

Operational default budgets are versioned configuration: 600 accepted/rejected ingest attempts per HMAC-IP per minute and 120 accepted attempts per project per minute. Tests inject smaller limits. Production can override downward/upward through non-public environment variables after reject-rate review.

---

## Task 1: Prove install and import inertness across every package manager

**Files:**

- Create: `tools/inert-install/project.json`
- Create: `tools/inert-install/verify-inert-install.mjs`
- Create: `tools/inert-install/import-probe.mjs`
- Create: `tools/inert-install/trace-parser.mjs`
- Create: `tools/inert-install/trace-parser.spec.mjs`
- Create: `tools/inert-install/fixtures/npm/package.json`
- Create: `tools/inert-install/fixtures/pnpm/package.json`
- Create: `tools/inert-install/fixtures/yarn/package.json`
- Create: `tools/inert-install/fixtures/bun/package.json`
- Create manager lock/config files under those fixture directories
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/ci-workflow.spec.mjs`
- Reuse/modify only as needed: `libs/telemetry/scripts/assemble-dist.spec.mjs`, `scripts/mit-cutover.spec.mjs`

- [ ] **Step 1: Test trace parsing red.** Feed representative Linux `strace` lines and require rejection of every AF_INET/AF_INET6 `connect`, including child processes, while Unix-domain connections are allowed.

- [ ] **Step 2: Add manifest/dependency tests.** Pack all six release packages, inspect packed manifests for `preinstall|install|postinstall|prepare|bin`, and walk packed dependency metadata for Scarf/configured install-analytics packages.

- [ ] **Step 3: Add import probes.** Stub/trace fetch, HTTP, HTTPS, DNS, sockets, file identity writes, and browser localStorage. Import each public entry point and construct providers/clients without an eligible runtime operation.

- [ ] **Step 4: Run red.**

```bash
node --test tools/inert-install/trace-parser.spec.mjs
npx nx run inert-install:test --skip-nx-cache
```

Expected: FAIL because the project/fixtures do not exist.

- [ ] **Step 5: Implement the verifier.** Build tarballs, prewarm manager stores, reset fixture install state, install only local tarballs offline under `strace -f -e trace=network`, and run import probes. The verifier itself must distinguish manager cache activity from package lifecycle execution and fail on any lifecycle-originated network syscall.

- [ ] **Step 6: Add the Ubuntu CI gate.** Install pinned pnpm, Yarn, Bun, and `strace`; run after package builds. Local Darwin runs parser/manifest/import tests but reports the syscall matrix as CI-only.

- [ ] **Step 7: Run green where supported.**

```bash
node --test tools/inert-install/trace-parser.spec.mjs
npx nx run inert-install:test --skip-nx-cache
npx nx run inert-install:verify --skip-nx-cache
```

Expected on Linux CI: all four offline installs/import probes complete with zero AF_INET/AF_INET6 connections attributable to package lifecycle execution.

---

## Task 2: Replace the open SDK model with one versioned five-event contract

**Files:**

- Create: `libs/telemetry/src/shared/contract.ts`
- Create: `libs/telemetry/src/shared/contract.spec.ts`
- Modify: `libs/telemetry/src/shared/events.ts`
- Modify: `libs/telemetry/src/shared/public-api.ts`
- Modify: `libs/telemetry/src/index.ts`
- Modify: `libs/chat/src/lib/agent/runtime-telemetry.ts`
- Modify associated type/spec files in Chat

- [ ] **Step 1: Write the five valid-event tests.** Assert the exact common/event-specific shapes and normalization into the wire request.

- [ ] **Step 2: Write every rejection test.** Unknown event/key/property/enum, cross-event property, array, depth four, malformed UUID/SemVer/time/hash, overlong strings, raw content-like properties, and `$` prefixes.

- [ ] **Step 3: Run red.**

```bash
npx nx test telemetry --skip-nx-cache
```

Expected: FAIL because arbitrary `tplane:*` events/properties remain valid.

- [ ] **Step 4: Implement a closed discriminated union and runtime parser.** Remove public construction/request/start/end/error names. Keep closed local error categories out of the growth wire path.

- [ ] **Step 5: Narrow the Chat sink types.** Preserve a caller-supplied sink for inspection/testing, but it receives only approved milestone payloads.

- [ ] **Step 6: Run green.**

```bash
npx nx test telemetry --skip-nx-cache
npx nx test chat --skip-nx-cache
npx nx run chat:type-tests --skip-nx-cache
```

Expected: PASS.

---

## Task 3: Implement lazy project/session identity, claim secret, controls, and transport

**Files:**

- Create: `libs/telemetry/src/shared/identity.ts`
- Create: `libs/telemetry/src/shared/identity.spec.ts`
- Create: `libs/telemetry/src/shared/claim.ts`
- Create: `libs/telemetry/src/shared/claim.spec.ts`
- Create: `libs/telemetry/src/browser/project-store.ts`
- Create: `libs/telemetry/src/browser/project-store.spec.ts`
- Create: `libs/telemetry/src/node/project-store.ts`
- Create: `libs/telemetry/src/node/project-store.spec.ts`
- Create: `libs/telemetry/src/node/transport.spec.ts`
- Modify: `libs/telemetry/src/shared/env.ts`
- Modify: `libs/telemetry/src/shared/env.spec.ts`
- Modify: `libs/telemetry/src/shared/anon-id.ts`
- Modify: `libs/telemetry/src/node/client.ts`
- Modify: `libs/telemetry/src/node/adapter.ts`
- Modify: `libs/telemetry/src/browser/service.ts`
- Modify: `libs/telemetry/src/browser/tokens.ts`
- Modify: `libs/telemetry/src/browser/browser-silence.spec.ts`
- Modify public entry points and README only as needed for package users; the website privacy plan controls rendered site copy

- [ ] **Step 1: Test import/construction silence.** No UUID, filesystem, localStorage, fetch, HTTP, DNS, or socket action before the first eligible milestone.

- [ ] **Step 2: Test first-use identity.** Lazily create a UUID project, one nonpersistent session UUID, and a cryptographically random 32-byte claim secret. Browser persistence is versioned localStorage; Node persistence is an atomic permission-restricted file keyed by SHA-256 of cwd, with no cwd/path in any payload.

- [ ] **Step 3: Test claim registration retries.** Send the same claim hash on every eligible event until a successful gateway response explicitly acknowledges project registration. Lost response repeats the identical hash; a registration acknowledgment stops it.

- [ ] **Step 4: Test control precedence.** `telemetry:false`, programmatic disable, `DO_NOT_TRACK=1`, `TPLANE_TELEMETRY_DISABLED=1`, and CI disable before any ID allocation. Invalid explicit ID/endpoint overrides disable capture rather than split identity.

- [ ] **Step 5: Test debug mode.** `TPLANE_TELEMETRY_DEBUG=1` (and browser programmatic `debug:true`) prints the exact endpoint and payload with secrets omitted, performs no network request, and leaves product behavior unchanged.

- [ ] **Step 6: Test transport failure isolation.** Timeout, DNS, 400, 429, and 500 never reject or delay the runtime API. Use a short abortable timeout and no unbounded retry queue.

- [ ] **Step 7: Run red then implement.**

```bash
npx nx test telemetry --skip-nx-cache
npx nx build telemetry --configuration=production --skip-nx-cache
```

Expected after implementation: PASS, and built entry points remain import-inert.

---

## Task 4: Make Chat's milestone sink the default while preserving overrides

**Files:**

- Modify: `libs/chat/package.json`
- Modify: `libs/chat/ng-package.json`
- Modify: `package-lock.json`
- Modify: `libs/chat/src/lib/agent/runtime-telemetry.ts`
- Modify: `libs/chat/src/lib/agent/agent.ts` and/or the actual runtime-construction file selected during implementation
- Modify: `libs/chat/src/lib/agent/*.spec.ts` covering resolver precedence
- Modify: `libs/langgraph/src/lib/agent.types.ts`
- Modify: `libs/langgraph/src/lib/agent.provider.ts`
- Modify: `libs/ag-ui/src/lib/provide-agent.ts`

- [ ] **Step 1: Write resolver precedence tests.** `telemetry:false` disables all sinks; an explicit custom sink wins; otherwise the built-in nonblocking milestone sink is used. Environment/programmatic disables still win inside the built-in sink.

- [ ] **Step 2: Run red.**

```bash
npx nx test chat --skip-nx-cache
npx nx run chat:type-tests --skip-nx-cache
```

Expected: FAIL because the current default is no sink.

- [ ] **Step 3: Add the package dependency.** Import only the browser-safe telemetry entry; add `@threadplane/telemetry` to `allowedNonPeerDependencies` so Angular packaging is explicit. Update `package-lock.json` with hunk-level review because it is already dirty in the current worktree.

- [ ] **Step 4: Install the resolver in each runtime construction path.** Do not create identity during dependency injection or construction.

- [ ] **Step 5: Update public option descriptions in source without adding website promises.** `telemetry:false` remains the explicit runtime disable.

- [ ] **Step 6: Run green.**

```bash
npx nx test chat --skip-nx-cache
npx nx run chat:type-tests --skip-nx-cache
npx nx build chat --configuration=production --skip-nx-cache
```

Expected: PASS.

---

## Task 5: Emit LangGraph milestones only at semantic success seams

**Files:**

- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`
- Modify: `libs/langgraph/src/lib/agent.fn.ts`
- Modify: `libs/langgraph/src/lib/agent.fn.spec.ts`
- Modify: `libs/langgraph/src/lib/agent.types.ts`
- Modify: `libs/langgraph/src/lib/lifecycle.ts`
- Modify: `libs/langgraph/src/lib/lifecycle.spec.ts`

- [ ] **Step 1: Test connection.** Emit once per runtime session after the first decoded event, immediately before `processEvent(event)`, for owned and joined streams; no construction/request event. The gateway still scores `transport.connected` once per project, but per-session connection facts are required to derive a seven-day return.

- [ ] **Step 2: Test completion.** Emit once only when `finalizeClosedAttempt(...) === 'success'`, with a closed duration bucket. Abort, error, pause, or interrupt terminal states do not count.

- [ ] **Step 3: Test persistence.** Initial `refreshHistory(false)` with a nonempty remote checkpoint predating this runtime emits once. General history subscriptions and `refreshHistory(true)` after a run do not.

- [ ] **Step 4: Test interrupt handling.** Submission alone does not count. After resumed completion succeeds, emit once with a typed resolution-kind hint (default `provided`) and never inspect/transmit the resolution value.

- [ ] **Step 5: Run red then implement.**

```bash
npx nx test langgraph --skip-nx-cache
npx nx run langgraph:type-tests --skip-nx-cache
```

Expected after implementation: PASS for owned/joined streams and all negative outcomes.

---

## Task 6: Emit AG-UI milestones only from protocol-confirmed success

**Files:**

- Modify: `libs/ag-ui/src/lib/to-agent.ts`
- Modify: `libs/ag-ui/src/lib/to-agent.spec.ts`
- Modify: `libs/ag-ui/src/lib/to-agent.resume.spec.ts`
- Modify: `libs/ag-ui/src/lib/to-agent.resume-wire.spec.ts`
- Modify: `libs/ag-ui/src/lib/provide-agent.ts`
- Modify: `libs/ag-ui/src/lib/provide-agent.spec.ts`

- [ ] **Step 1: Test connection on first `RUN_STARTED`.** It fires once per runtime session and contains no run/thread/provider ID. The gateway's project milestone key, not the SDK latch, prevents repeated score credit.

- [ ] **Step 2: Test completion on successful `RUN_FINISHED`.** Interrupted `RUN_FINISHED` reduces to paused and does not count; transport close without successful finish does not count.

- [ ] **Step 3: Make `executeRun` expose/retain its final outcome.** Use that result to emit success-only completion and success-only resume handling.

- [ ] **Step 4: Test resolution payload exclusion.** Only the approved resolution-kind enum crosses the sink.

- [ ] **Step 5: Run red then implement.**

```bash
npx nx test ag-ui --skip-nx-cache
npx nx run ag-ui:type-tests --skip-nx-cache
```

Expected after implementation: PASS.

---

## Task 7: Emit generative UI activation only after a real renderer mounts

**Files:**

- Modify: `libs/render/src/lib/lifecycle.ts`
- Modify: `libs/render/src/lib/lifecycle.spec.ts`
- Modify: `libs/render/src/lib/render-lifecycle.service.ts`
- Modify: `libs/render/src/lib/render-element.component.ts`
- Modify: `libs/render/src/lib/render-element.component.spec.ts`
- Modify: `libs/render/src/lib/render-spec.component.ts`
- Modify: `libs/render/src/lib/render-spec.component.spec.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`

- [ ] **Step 1: Test the negative seam.** Non-null specs and wrapper `ngOnInit` do not emit activation.

- [ ] **Step 2: Extend the lifecycle with one actual-mount fact.** Emit only after `mountedReal` sees `!notReady()` and a registered `entry()?.component`; latch once.

- [ ] **Step 3: Translate in Chat.** The central JSON Render/A2UI handlers attach effective runtime sink context and emit `renderer:'json_render'|'a2ui'` without spec/state content.

- [ ] **Step 4: Run red then implement.**

```bash
npx nx test render --skip-nx-cache
npx nx test chat --skip-nx-cache
```

Expected after implementation: PASS; actual mount counts once, spec presence never counts.

---

## Task 8: Migrate rate limiting to HMAC fixed-window buckets

**Files:**

- Create: `migrations/0004_ingest_rate_limit_buckets.sql`
- Modify: `scripts/rate-limit.ts`
- Modify: `scripts/rate-limit.spec.ts`
- Create: `apps/website/src/lib/telemetry/ip-hash.ts`
- Create: `apps/website/src/lib/telemetry/ip-hash.spec.ts`
- Create: `apps/website/src/lib/telemetry/rate-limit.ts`
- Create: `apps/website/src/lib/telemetry/rate-limit.spec.ts`

- [ ] **Step 1: Write failing generic limiter tests.** Require `scope`, HMAC subject hash, fixed bucket start, atomic increment/upsert, expiry cleanup, injected limits/time, and fail-closed result for analytics.

- [ ] **Step 2: Preserve existing demo behavior safely.** Migrate the canonical demo caller to the same hashed subject API; product requests retain their current fail-open product policy, while analytics ingest drops/fails closed.

- [ ] **Step 3: Write the migration.** Convert the ephemeral raw-IP table into generic hashed buckets, removing stored raw IP rows. Keep this operational table outside the five growth CRM tables.

- [ ] **Step 4: Run red then implement.**

```bash
npx vitest run scripts/rate-limit.spec.ts apps/website/src/lib/telemetry/ip-hash.spec.ts apps/website/src/lib/telemetry/rate-limit.spec.ts
TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate
```

Expected after implementation: PASS; no raw IP column/value remains.

---

## Task 9: Harden `/api/ingest`, register projects, and write set-based projections

**Files:**

- Create: `apps/website/src/lib/telemetry/ingest-contract.ts`
- Create: `apps/website/src/lib/telemetry/ingest-contract.spec.ts`
- Create: `apps/website/src/lib/telemetry/posthog.ts`
- Create: `apps/website/src/lib/telemetry/project-registration.ts`
- Create: `apps/website/src/lib/telemetry/project-registration.spec.ts`
- Modify: `apps/website/src/app/api/ingest/route.ts`
- Replace/expand: `apps/website/src/app/api/ingest/route.spec.ts`
- Modify: `libs/growth/src/lib/jobs.ts` or add a focused project/activity repository in `libs/growth`; do not create a competing website repository

- [ ] **Step 1: Test body handling before JSON parsing.** Reject missing/invalid content length, streamed bodies over 8 KiB, malformed JSON, arrays, and depth four with the approved generic public response text.

- [ ] **Step 2: Test exact schema and server ownership.** Cover every valid event and every malformed/spoofed field. Caller-supplied source/verification/identity/IP/person-profile/reserved properties cannot survive.

- [ ] **Step 3: Test two budgets.** HMAC-IP before expensive work and project budget after validation/registration. Limiter/storage failure drops the analytics request; SDK still swallows it.

- [ ] **Step 4: Test first-write project registration.** Unknown project requires claim hash; insert project with stored opaque PostHog distinct ID and claim hash; identical retries acknowledge; conflicting hash rejects and never replaces.

- [ ] **Step 5: Test idempotent projections without a raw event lake.** Accept `transport.connected` once per session and insert `runtime:session:<project>:<session>:transport.connected`; derive `project.returned_7d` from a second distinct session 24 hours to seven days later. For all five events, a separate `runtime:milestone:<project>:<event>` key limits score to once per project. Replays/new event IDs cannot add score. Raw request bodies are not persisted.

- [ ] **Step 6: Test PostHog projection.** Use stored opaque distinct ID, event ID as `$insert_id`, no claim hash/PII, and server-owned normalized fields. Duplicate network forwarding is acceptable; downstream insert ID and Neon set keys make outcomes idempotent.

- [ ] **Step 7: Run red then implement.**

```bash
npx nx test website -- --run apps/website/src/lib/telemetry apps/website/src/app/api/ingest/route.spec.ts
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx nx run growth:test-integration
```

Expected after implementation: malformed/spoofed/replayed/abusive inputs are rejected, valid events return registration acknowledgment, and product code never sees gateway failures.

---

## Task 10: Implement the explicit one-time project claim and `/connect`

**Files:**

- Modify: `libs/telemetry/src/shared/claim.ts`
- Modify: `libs/telemetry/src/shared/claim.spec.ts`
- Create: `apps/website/src/app/connect/page.tsx`
- Create: `apps/website/src/components/connect/ProjectClaimForm.tsx`
- Create: `apps/website/src/components/connect/ProjectClaimForm.spec.tsx`
- Create: `apps/website/src/app/api/growth/projects/claim/route.ts`
- Create: `apps/website/src/app/api/growth/projects/claim/route.spec.ts`
- Modify: `apps/website/e2e/public-copy.spec.ts`
- Extend: `libs/growth/src/lib/contacts.ts`/project repository with the post-proof link-and-approve transaction

- [ ] **Step 1: Test the local URL API.** Before identity exists, `getThreadplaneProjectClaimUrl()` returns no URL. After first eligible operation it returns `https://threadplane.ai/connect#project_id=<uuid>&claim_secret=<secret>`, without opening, logging, analytics capture, or automatic transmission.

- [ ] **Step 2: Test fragment handling.** The client reads the fragment and calls `history.replaceState` immediately before navigation/analytics/rendered form activity. The raw secret never enters query params, server logs, referrers, or PostHog.

- [ ] **Step 3: Test proof.** Hash the submitted secret; constant-time compare to the first-write stored hash; atomically require `claim_consumed_at is null`; reject UUID-only, wrong, conflicting, replayed, or consumed claims uniformly.

- [ ] **Step 4: Test identity transition.** On proof success, upsert/link the contact, record `project.claimed` and exact visible connect notice, set approval only through the lifecycle plan's approval transaction, consume the claim once, and enqueue the standard lifecycle jobs. Prior runtime events remain `client_reported`.

- [ ] **Step 4a: Extend the permanent public-output boundary.** Add `/connect` to the non-indexed-route crawl and assert its HTML and public claim responses contain no blocked website term from the privacy plan.

- [ ] **Step 5: Run red then implement.**

```bash
npx nx test telemetry -- --run libs/telemetry/src/shared/claim.spec.ts
npx nx test website -- --run apps/website/src/components/connect/ProjectClaimForm.spec.tsx apps/website/src/app/api/growth/projects/claim/route.spec.ts
TEST_DATABASE_URL="$TEST_DATABASE_URL" npx nx run growth:test-integration
```

Expected after implementation: PASS.

---

## Task 11: Close website acquisition analytics and PostHog identity behavior

**Files:**

- Modify: `apps/website/instrumentation-client.ts`
- Modify: `apps/website/src/lib/analytics/events.ts`
- Create: `apps/website/src/lib/analytics/acquisition-contract.ts`
- Create: `apps/website/src/lib/analytics/acquisition-contract.spec.ts`
- Create: `apps/website/src/lib/analytics/content-registry.ts`
- Create: `apps/website/src/components/analytics/AnalyticsPageview.tsx`
- Create: `apps/website/src/components/analytics/AnalyticsPageview.spec.tsx`
- Create: `apps/website/src/components/analytics/ContentEngagement.tsx`
- Create: `apps/website/src/components/analytics/ContentEngagement.spec.tsx`
- Modify: `apps/website/src/lib/analytics/client.ts`
- Modify: `apps/website/src/lib/analytics/server.ts`
- Modify: `apps/website/src/lib/analytics/server.spec.ts`
- Modify: `apps/website/src/components/docs/CopyButton.tsx`
- Modify CopyButton and form component tests
- Modify: `apps/website/src/lib/analytics/ai-traffic.ts`
- Modify: `apps/website/src/lib/analytics/ai-traffic.spec.ts`
- Modify: `apps/website/src/middleware.ts`
- Modify middleware tests

- [ ] **Step 1: Test explicit PostHog init.** Require `person_profiles:'identified_only'`, `autocapture:false`, `disable_session_recording:true`, `capture_pageview:false`, `capture_pageleave:false`, `persistence:'memory'`, and DNT respect.

- [ ] **Step 2: Test pathname-only pageviews and a closed acquisition union.** Retain `$pageview`, CTA click, form submit, newsletter submit, whitepaper submit, registered content engagement, and annotated install-command copy. Strip query/fragment; remove open property index signatures.

- [ ] **Step 3: Test engagement semantics.** Registered content only, 30 active foreground seconds plus 50% scroll, once per session/content. Keep session ID short-lived/in-memory.

- [ ] **Step 4: Test install-copy semantics.** Only code blocks explicitly annotated with a published package and `npm|pnpm|yarn|bun` emit `docs:install_command_copied`; general copy does not.

- [ ] **Step 5: Remove noisy events.** Retire client success/failure, docs search strings/clicks, tabs/sidebar, blog/general copy, destination URLs, CTA text, and raw error reasons. Server persistence emits form acceptance.

- [ ] **Step 6: Remove server PII projections.** Delete deterministic email IDs and email/name/domain/company PostHog properties. Emit only a random contact projection after Neon persistence when a server business event needs it.

- [ ] **Step 7: Close crawler/referrer analytics.** Retain these as non-scoring operational events only. Map crawler tokens to `openai|anthropic|perplexity|google|apple|bytedance|meta|common_crawl`; map answer-engine referrers to `chatgpt|perplexity|claude|gemini|copilot|you`; send pathname only and never raw user-agent/referrer.

- [ ] **Step 8: Run red then implement.**

```bash
npx nx test website -- --run apps/website/src/lib/analytics apps/website/src/components/analytics
npx nx test website
npx nx build website --configuration=production --skip-nx-cache
```

Expected after implementation: PASS; automated scans/mocks see no raw email/name/company/hash/query/fragment/user-agent in PostHog calls.

---

## Task 12: Replace PostHog contracts, dashboards, and rollout controls

**Files:**

- Modify: `tools/posthog/telemetry-contract.ts`
- Modify: `tools/posthog/telemetry-contract.spec.ts`
- Modify: `tools/posthog/taxonomy.spec.ts`
- Modify: `tools/posthog/schema.ts`
- Modify: `tools/posthog/schema.spec.ts`
- Modify: `tools/posthog/dashboards/developer-funnel.json` (sole cross-plan dashboard owner; consume lifecycle-exported campaign outcome definitions without letting the lifecycle plan edit this file)
- Replace/remove obsolete `tools/posthog/dashboards/runtime-telemetry.json`
- Replace/remove old runtime insight JSON files with five milestone/activation definitions
- Modify: `docs/gtm/taxonomy.md`

- [ ] **Step 1: Test the new source/trust split.** Public runtime events are always client-reported; server events use the internal capture path; acquisition events cannot masquerade as activation.

- [ ] **Step 2: Replace old dashboards/insights.** Use the five milestones, return-within-seven-days, acquisition depth, and aggregate campaign outcomes. Keep public/server verification visible. Do not add open/click metrics.

- [ ] **Step 3: Add reject/abuse operational definitions.** Monitor gateway reject rate, IP/project budget exhaustion, conflicting project hashes, event-ID collisions observed downstream, unusual event distribution, and cardinality growth.

- [ ] **Step 4: Run local contract verification.**

```bash
npx nx test posthog-tools --skip-nx-cache
npm run posthog:sync
```

Expected: tests pass and sync plan shows only intended definitions. Do not run `npm run posthog:apply` during implementation.

---

## Task 13: Full verification and staged rollout

**Files:**

- Modify: `.github/workflows/ci.yml` and scope tests as needed to select inert-install and changed runtime surfaces
- Create: `docs/superpowers/runbooks/2026-08-31-runtime-analytics-rollout.md`

- [ ] **Step 1: Run the complete local project surface.**

```bash
npx nx run-many -t test --projects=telemetry,chat,langgraph,ag-ui,render,website,posthog-tools --skip-nx-cache
npx nx run-many -t lint --projects=telemetry,chat,langgraph,ag-ui,render,website,posthog-tools --skip-nx-cache
npx nx run chat:type-tests --skip-nx-cache
npx nx run langgraph:type-tests --skip-nx-cache
npx nx run ag-ui:type-tests --skip-nx-cache
npx nx run-many -t build --projects=telemetry,chat,langgraph,ag-ui,render --configuration=production --skip-nx-cache
npx nx build website --configuration=production --skip-nx-cache
node --test scripts/ci-scope.spec.mjs scripts/ci-workflow.spec.mjs
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Run the Linux-only install gate in CI.**

```bash
npx nx run inert-install:verify --skip-nx-cache
```

Expected: all four managers report zero lifecycle network syscalls.

- [ ] **Step 3: Deploy strict ingest dark.** Accept no old open events; validate/reject and observe rates before publishing the SDK default. Keep failures silent to product callers.

- [ ] **Step 4: Deploy `/connect` and privacy-safe website PostHog settings.** Verify claim fragment clearing and one-time consumption with test projects.

- [ ] **Step 5: Deploy the canonical privacy-policy plan before default-on runtime capture.** Crawl production using that plan's output boundary.

- [ ] **Step 6: Publish runtime instrumentation gradually.** Shadow validation, sampled/test projects, then default-on eligible operations. Construction/import/install remain inert; opt-out/debug are verified in packed consumer fixtures.

- [ ] **Step 7: Apply PostHog definitions only after reviewing the sync plan.** Keep old dashboards during a short comparison window but stop producing old client events in the new release.

- [ ] **Step 8: Tune budgets from observed reject distribution.** Document any default change and keep tests configuration-driven.

- [ ] **Step 9: Create one logical commit after full verification.** Repository guidance forbids mid-task commits. Re-record `git status --short`, inspect `git diff -- <explicit runtime-owned paths>`, and stage only those paths/hunks; never use a broad `git add apps/website`, `git add .`, or lockfile overwrite.

---

## Acceptance checklist

- All published packages install/import with no lifecycle network call or identity write.
- First eligible operation lazily creates stable project/claim identity and a nonpersistent session; explicit controls prevent even that allocation.
- Exactly five allowlisted milestones exist, and semantic tests prove their success conditions.
- `/api/ingest` enforces byte/depth/schema/time/idempotency/rate/claim rules and labels every public fact client-reported.
- Neon stores only project/contact/business projections, not raw product payloads; PostHog receives no PII or claim secret.
- Project UUID alone cannot link identity; one-time possession proof plus visible approval is required.
- Website PostHog is explicit-only, memory-persistent, identified-profile-only, and query/fragment/user-agent safe.
- Anonymous signals can score projects but cannot select an individual or authorize outreach.
