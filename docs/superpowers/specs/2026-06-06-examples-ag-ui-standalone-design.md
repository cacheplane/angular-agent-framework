# Standalone AG-UI Example (examples/ag-ui) — Design

**Status:** Draft
**Date:** 2026-06-06
**Owner:** Brian Love

## Problem

`examples/chat/` is the canonical, clone-and-run, full-stack reference example: a polished Angular chat app (LangGraph adapter) + a feature-rich Python graph (a2ui generative UI, streaming envelopes, tool calls), deployed to `demo.threadplane.ai` (frontend) and LangGraph Cloud (backend). There is no equivalent standalone example for the **AG-UI** transport. The cockpit ships only `ag-ui/streaming` and `ag-ui/interrupts` cards — single-capability demos, not a polished peer to the canonical chat demo.

We want a standalone `examples/ag-ui/` that is a true peer to `examples/chat/` — the **same chat UX with full feature parity**, re-fronted with the AG-UI adapter — to demonstrate LangGraph↔AG-UI transport parity as a marketing-grade reference.

## Feasibility (resolved via static spike)

The chat UI consumes a neutral `Agent` contract that both adapters implement, so the entire UI + a2ui rendering stack is transport-agnostic — with **one** gap:

- **Final a2ui surfaces** arrive in assistant-message content (`---a2ui_JSON---` wrapper), parsed by `libs/chat/.../content-classifier.ts`, rendered from `classified.a2uiSurfaces()`. Fully neutral — renders over AG-UI today.
- **Live/progressive a2ui streaming** is driven by `chat.component.ts:548`, which duck-types for an `agent.customEvents()` **Signal**. Only the LangGraph adapter exposes it (`libs/langgraph/.../agent.fn.ts`). The AG-UI adapter emits the same custom events on its `events$` Observable (`libs/ag-ui/src/lib/reducer.ts:180` CUSTOM case) but not as a `customEvents` signal. Without it, progressive a2ui silently falls back to final-surface rendering.

**Conclusion:** full parity is achievable by adding one bounded library capability (the `customEvents` signal) plus the example itself. No rework.

## Goals

- A standalone `examples/ag-ui/` peer to `examples/chat/` with full feature parity (a2ui, tool calls, streaming).
- Close the live-a2ui-streaming gap in `@threadplane/ag-ui` (genuine adapter capability, valuable beyond this example).
- Deploy as a true peer to the canonical demo: dedicated Railway backend + `ag-ui-demo.threadplane.ai` frontend.
- Demonstrate that everything above the `Agent` contract is byte-identical to `examples/chat` — that *is* the parity proof.

## Non-Goals

- No change to the LangGraph adapter or the canonical demo (LangGraph already has `customEvents`; nothing to migrate).
- No LangGraph Cloud deployment of this graph (uvicorn/Railway by nature).
- No merge with the cockpit `ag-ui-dev` service (deliberately separate marketing/dev boundary).
- No capabilities beyond `examples/chat` parity.

## Design

### Part 1 — Library: `customEvents` signal on `@threadplane/ag-ui`

Add `customEvents: Signal<CustomStreamEvent[]>` to the agent returned by `toAgent`/`provideAgent`, accumulating the custom events the reducer already emits (the `CUSTOM` case re-emits `{type:'custom', name, data}` on `events$`). Mirrors `libs/langgraph/.../agent.fn.ts` (`custom$` BehaviorSubject → `toSignal`). Lifecycle: accumulates within a run, resets per run, does not leak across threads.

This is the one symbol `chat.component.ts:548` duck-types for to feed the partial-args bridge — adding it enables token-by-token a2ui rendering over AG-UI. Without it, a2ui still renders (final-surface fallback).

- **Unit tests** (co-located in `libs/ag-ui`): `customEvents` accumulates CUSTOM events in order; resets per run; absent custom events → empty signal.
- **Docs:** regenerate `apps/website/content/docs/ag-ui/api/api-docs.json` (via `npm run generate-api-docs`); update the AG-UI adapter reference/guide that enumerates the agent surface to list `customEvents`; add a note to the a2ui/generative-ui guidance that AG-UI now supports live a2ui streaming.

Lands as its own PR (small, self-contained), before the example.

### Part 2 — Example: `examples/ag-ui/`, a peer to `examples/chat/`

Three units mirroring the canonical demo:

**`examples/ag-ui/angular/`** — the chat UI, fronted by the AG-UI adapter:
- `provideAgent({ url: '/agent' })` + `@threadplane/ag-ui` instead of `LANGGRAPH_THREADS_CONFIG` + `@threadplane/langgraph`.
- The `<chat>` composition, a2ui rendering, and `@threadplane/render` usage are **unchanged** (neutral contract) — this identity is the parity demonstration.
- `provideChat`, telemetry, routing mirror `examples/chat/angular`.

**`examples/ag-ui/python/`** — the `examples/chat` a2ui graph, **duplicated** (copy, don't import, per the standalone-examples convention), served over AG-UI:
- `server.py` wraps the graph with `ag-ui-langgraph`'s `LangGraphAgent` + `add_langgraph_fastapi_endpoint(path='/agent')`, plus an unauthenticated `/ok` health route.
- Auth middleware reuses the proven `ag-ui-dev` shape (returns `JSONResponse(status_code=401)` — NOT `raise HTTPException`, which surfaces as 500 inside Starlette middleware), **enforced only when `AG_UI_INTERNAL_TOKEN` is set** so `git clone && docker run` works locally without it.
- Self-contained deployment artifacts live here: `Dockerfile` (multi-stage python:3.12-slim), `entrypoint.sh` (uvicorn + watchdog with startup grace), `railway.json` (healthcheck `/ok`). The example deploys on its own — no separate `deployments/` dir, no generator (single graph).

**`examples/ag-ui/smoke/`** — the create-app smoke harness mirrored from `examples/chat/smoke/` (`cli.mjs` + `template/`): scaffolds a fresh consumer app from the **published** `@threadplane/ag-ui` + `@threadplane/chat` packages and verifies it builds/runs, catching ag-ui packaging regressions.

### Part 3 — Deploy: dedicated Railway + Vercel subdomain

**Backend (Railway):** a new dedicated service `ag-ui-demo` (separate from cockpit `ag-ui-dev`). Built from `examples/ag-ui/python/`'s self-contained Dockerfile. Env: `OPENAI_API_KEY`, `AG_UI_INTERNAL_TOKEN`.

**Frontend (Vercel):** a new project `threadplane-ag-ui-demo` → `ag-ui-demo.threadplane.ai`, assembled by `scripts/assemble-ag-ui-demo.ts` (mirrors `assemble-demo.ts`): builds the SPA, emits Build Output `config.json` routing `/agent*` → a proxy function (named `[[...path]]`, per the Vercel Build Output rule) and SPA fallback.

**Proxy:** a small dedicated middleware (mirrors `demo-middleware.ts` + the established `ag-ui-proxy.ts` defense): origin allowlist (`ag-ui-demo.threadplane.ai` + localhost), Upstash rate-limit (fail-open), `X-Internal-Token` injection, streaming-aware fetch → the `ag-ui-demo` Railway service.

**CI** (`.github/workflows/ci.yml`): three new jobs mirroring `examples/chat` + the canonical demo:
- `examples/ag-ui — python smoke` (graph imports/tests)
- `examples/ag-ui — e2e` (aimock replay — see Testing)
- `ag-ui demo → Vercel` deploy, gated on the above being green (refuse-on-red guard like the canonical demo) + a Railway `up`.
Path-filtered on `examples/ag-ui/**` + the assemble/proxy scripts.

**Provisioning** (Railway service + project deploy token + env; Vercel project + custom domain + env) done via API; GitHub secret for the Railway token. Only manual step: the OpenAI spend cap.

### Testing

The key enabler: **aimock mocks the OpenAI provider, not the transport** — so the same graph over AG-UI replaying the same recorded LLM fixtures yields the same a2ui surfaces. Fixtures port transport-agnostically.

**e2e — port `examples/chat/angular/e2e/`:**
- `aimock-runner.ts` + `global-setup.ts`: start the uvicorn AG-UI backend with aimock intercepting OpenAI + replaying fixtures; serve the Angular app via `provideAgent`.
- Port specs: `initial-render`, `a2ui-single-bubble` (**critical parity assertion** + regression guard for the new `customEvents` signal), `markdown-surfaces`, `color-scheme`, `error-handling`, `browser-hygiene`. Fixtures copied from `examples/chat` (same graph, same responses).

**Library unit tests** (Part 1): `customEvents` accumulation/order/reset.

**Production validation (post-deploy):** `/ok` 200; `ag-ui-demo.threadplane.ai` loads; one live a2ui run renders end-to-end; proxy returns 403/413/429 on the abuse paths.

## Risks

- **`customEvents` lifecycle** — must reset per run, not leak across threads. Reference: the LangGraph impl. Guarded by unit tests + the `a2ui-single-bubble` e2e.
- **AG-UI SSE encoding of tool-call/custom args** — aimock sits below the transport (deterministic LLM replay), but ag-ui-langgraph wraps tool-call/custom events differently than the LangGraph transport. If a2ui renders differently over AG-UI, the ported e2e catches it — the parity signal we want.
- **Graph duplication drift** — the copied graph can diverge from `examples/chat`'s; accepted per the standalone-examples convention, noted in the example README.
- **New infra** — new Railway service + Vercel project + subdomain (API-provisionable, but the most moving parts of recent efforts).

## Sequencing

1. **PR 1 — Library:** `customEvents` signal + unit tests + docs regen. Small, self-contained; lands first.
2. **PR 2 — Example (local):** `examples/ag-ui/{angular,python,smoke}` + ported e2e, fully runnable via clone (token-optional backend). No cloud.
3. **PR 3 — Deploy:** assemble-ag-ui-demo + proxy + CI jobs + provisioning.

Honest effort: the largest recent effort — three PRs, a full e2e port, fresh infra. Realistically multi-session.

## Files (high level)

**New:**
- `libs/ag-ui/src/lib/...` — `customEvents` signal wiring + spec (Part 1)
- `examples/ag-ui/angular/**` — chat app over ag-ui + ported e2e
- `examples/ag-ui/python/**` — duplicated graph + server.py + Dockerfile + entrypoint.sh + railway.json
- `examples/ag-ui/smoke/**` — create-app smoke harness
- `examples/ag-ui/project.json` (+ angular/python/smoke project.json)
- `scripts/assemble-ag-ui-demo.ts` + the ag-ui demo proxy middleware

**Modified:**
- `libs/ag-ui/src/lib/to-agent.ts` (expose `customEvents`)
- `apps/website/content/docs/ag-ui/**` (api-docs regen + signal docs)
- `.github/workflows/ci.yml` (three new jobs + deploy trigger)
