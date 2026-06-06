# Cockpit Examples — Local-Dev + Validator Cleanup

**Date:** 2026-06-05
**Status:** Design — pending review
**Depends on:** PR #580 (`feat(ag-ui): host runtimes on Railway via ag-ui-dev deployment`). This work **lands after #580 merges**; implementation rebases onto post-#580 `main` and reconciles any overlap before starting.

## Problem

An audit of how the 33 cockpit capability examples are wired for local dev and production found that the **metadata layer is fully symmetric** (registry ↔ `ports.mjs` ↔ `route-resolution.ts` ↔ per-module `devPort` all agree, 33 caps), but the **serve/deploy tooling** has real gaps:

1. **Local runtime resolution is broken for every cap.** `apps/cockpit/src/lib/content-bundle.ts` `resolveRuntimeUrl` uses `process.env['NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL'] ?? 'https://examples.threadplane.ai'`; if `runtimeUrl` is set it returns `${baseUrl}/${runtimeUrl}`, otherwise falls back to `http://localhost:${devPort}`. Every capability module sets BOTH `runtimeUrl` and `devPort`, and **no local-dev tooling ever sets the env var to `''`**. So `nx run cockpit:serve-streaming` boots a local Angular app + backend that the cockpit iframe **never talks to** — the iframe always loads the *deployed* example. The `devPort` localhost branch is dead code in practice.

2. **Stale backend port in the `serve-*` targets.** The hand-written `serve-*` targets in `apps/cockpit/project.json` and `serve-example.ts` launch the backend with `langgraph dev --port 8123`, but the Angular dev proxy (`cockpit/<product>/<topic>/angular/proxy.conf.mjs`) targets `portsFor(<project>).langgraph` (53xx). The e2e harness (`libs/e2e-harness/src/global-setup-factory.ts`) and the port validator (`scripts/cockpit-ports.spec.mjs`) both use the `ports.mjs` value. `8123` is stale; a local langgraph backend would be unreachable through the proxy.

3. **`serve-example.ts` mis-launches ag-ui.** It runs `langgraph dev` for any capability with a `pythonDir`. ag-ui caps have a `pythonDir` but are `uvicorn`/FastAPI servers (`uv run uvicorn src.server:app --port <port>`), so `serve-example.ts --capability=ag-ui-streaming` launches the wrong command.

4. **Serve-target asymmetry.** Only 14/33 caps (langgraph ×8, deep-agents ×6) have dedicated `serve-<cap>` targets. chat (11), render (6), ag-ui (2) are reachable only via `serve-example.ts`. Two parallel serve mechanisms have drifted (both carry the `8123` bug).

5. **Validator coverage gaps.** Nothing ties `capability-registry.ts` ↔ `ports.mjs`; the `cockpit-smoke` CI job hardcodes ag-ui/deep-agents/langgraph python and **omits all chat + render**; `cockpit-e2e-wiring.spec.ts` carries dead fallback branches (legacy `proxy.conf.json`, "cap not in registry") now that all caps are registered.

## Scope

This spec covers **three cohesive areas: local-dev runtime resolution, serve ergonomics, and validator coverage.** It touches **none of ag-ui production** — PR #580 (Railway) owns the ag-ui backend host, the `examples.threadplane.ai` ag-ui routing (`assemble-examples.ts` + `ag-ui-proxy.ts`), edge security middleware, and the `deploy-ag-ui.yml` CI. After #580 merges, `main` will contain `deployments/ag-ui-dev/`, `scripts/generate-ag-ui-deployment-config.ts`, ag-ui entries in `assemble-examples.ts`, and the ag-ui proxy; this work builds on that and must not duplicate or conflict with it.

## Design

### Area 1 — Local runtime resolution (all caps)

**1a. Set the env var on the local-serve path.** The single registry-driven orchestrator `apps/cockpit/scripts/serve-example.ts` becomes the place that exports `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL=''` into the cockpit (`nx serve cockpit`) child process it spawns. With the var set to empty string, `resolveRuntimeUrl`'s `baseUrl && runtimeUrl` branch is falsy and it falls through to `http://localhost:${devPort}` — the iframe loads the local Angular app. (`?? ` does not catch `''`; the `&&` does — verified in `content-bundle.ts`.)

**1b. Derive the backend port + command from the registry, not literals.** `serve-example.ts` and any retained `serve-*` targets stop hardcoding `langgraph dev --port 8123`. The backend launch is derived per-capability from `capability-registry.ts` / `ports.mjs`:
- **langgraph / deep-agents / chat / render** (langgraph-backed): `uv run langgraph dev --port <ports.langgraph> --no-browser` in `<pythonDir>`.
- **ag-ui** (uvicorn-backed): `uv run uvicorn src.server:app --port <ports.langgraph>` in `<pythonDir>`.
The discriminator is the capability's product (`product === 'ag-ui'`) or, equivalently, presence of a `langgraph.json` in `pythonDir` (ag-ui has none). Use the registry field that PR #580's generator already relies on for consistency — confirm at implementation time which field is canonical post-#580 (`graphName` presence is one candidate, since ag-ui omits it).

**1c. render caps need no backend.** render examples are pure client-side; `serve-example.ts` already may skip backends for `--all`. Per-capability serve should skip the backend launch for render caps (no `langgraph.json`, no uvicorn server) and just run the Angular app.

### Area 2 — Serve ergonomics: one source of truth

`serve-example.ts` (registry-driven, covers all 33 caps, knows backend type) becomes the **single blessed local-serve path**. The 14 hand-written `serve-*` targets in `apps/cockpit/project.json` are **replaced with thin aliases** that delegate to it, so the familiar `nx run cockpit:serve-streaming` keeps working without 14 hand-maintained command blocks:

```
"serve-streaming": { "command": "npx tsx apps/cockpit/scripts/serve-example.ts --capability=streaming", "cwd": "." }
```

(Chosen approach: alias-to-single-source. Rejected: hand-writing 19 more targets — duplicates drift risk; or deleting the named targets — breaks muscle memory and any docs referencing them.) The alias list is generated/checked against the registry so adding a capability surfaces a missing alias.

### Area 3 — Validator coverage

Add assertions so the gaps that let these asymmetries exist fail CI going forward:

**3a. registry ↔ ports.mjs parity.** Extend `scripts/cockpit-ports.spec.mjs` (or `cockpit-e2e-wiring.spec.ts`) to assert, for every capability, `capabilities[i].port === PORTS[name].angular` and (where defined) `capabilities[i].pythonPort === PORTS[name].langgraph`. Today these two registries are independent and could drift.

**3b. smoke list ↔ registry parity.** The `cockpit-smoke` CI job (`.github/workflows/ci.yml`) currently hardcodes a python project list that omits chat + render. Either (a) derive the smoke list from the registry (preferred — every cap with a `smoke` target is covered), or (b) keep the hardcoded list but add a spec asserting it equals the set of registry caps with a `smoke` target. Preferred: (a).

**3c. Remove dead validator code.** Delete the now-unreachable fallback branches in `apps/cockpit/cockpit-e2e-wiring.spec.ts`: the legacy `proxy.conf.json` `/api` check and the "Cap not in registry" `try/catch` fallback (all caps including ag-ui are now in `ports.mjs` with `.mjs` proxies). Keep the assertions; remove only the stale alternates so the spec reflects what is actually enforced.

## Out of scope

- **ag-ui production** — Railway PR #580 (backend host, `assemble-examples` ag-ui routing, `ag-ui-proxy.ts`, edge middleware, `deploy-ag-ui.yml`, production smoke).
- **Backporting proxy hardening to the langgraph proxy** — tracked in #580's own out-of-scope.
- The cockpit UI redesign (already shipped, PRs #570 / #578).
- New capabilities or backend logic — this is wiring/tooling only.

## Components & files

| File | Change |
|------|--------|
| `apps/cockpit/scripts/serve-example.ts` | Set `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL=''` on the cockpit child; derive backend port + command per-capability from the registry (langgraph dev vs uvicorn vs none); drop the `8123` literal. |
| `apps/cockpit/project.json` | Replace the 14 hand-written `serve-*` targets with thin aliases delegating to `serve-example.ts --capability=<id>`. |
| `apps/cockpit/scripts/capability-registry.ts` | (Read-only here unless a discriminator field is missing.) Confirm the langgraph-vs-uvicorn discriminator field is present for all caps. |
| `scripts/cockpit-ports.spec.mjs` | Add registry ↔ ports.mjs parity assertions (3a). |
| `.github/workflows/ci.yml` | Derive `cockpit-smoke` python list from the registry (3b). |
| `apps/cockpit/cockpit-e2e-wiring.spec.ts` | Remove dead fallback branches (3c); optionally add the smoke-list parity assertion if not done in ci.yml. |
| `apps/cockpit/scripts/serve-example.spec.ts` (new or extended) | Unit-test the per-capability backend-command derivation (langgraph dev for langgraph/deep-agents/chat, uvicorn for ag-ui, none for render) + the env-var injection. |

## Error handling

- `serve-example.ts` per-capability launch: if `pythonDir` is missing for a backend-requiring cap, fail fast with a clear message rather than silently skipping. render caps (no backend) skip cleanly with a log line.
- The env-var injection must only affect the spawned cockpit child, not leak into the user's shell or other concurrent serves.

## Testing

- **Unit:** `serve-example.spec.ts` asserts the derived command per product (uvicorn for ag-ui, langgraph dev for the rest, none for render) and that the cockpit child env includes `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL=''`.
- **Validator specs:** 3a/3b parity assertions (run in `nx test cockpit` / ci-scope job); 3c dead-code removal keeps `cockpit-e2e-wiring.spec.ts` green.
- **Manual local smoke (acceptance):** after implementation, run `serve-example.ts --capability=<id>` for one langgraph cap and one ag-ui cap; in the cockpit Run tab confirm (a) the iframe `src` is `http://localhost:<devPort>` (not `examples.threadplane.ai`), and (b) a chat turn streams a response end-to-end. This is the exact scenario the audit found broken.

## Risks

- **#580 reshape risk:** PR #580 may change in review (e.g. the discriminator field, the generator’s registry usage). The implementation **must rebase onto post-#580 main first** and re-confirm the canonical langgraph-vs-uvicorn discriminator and registry fields before writing code. The spec deliberately references #580 infra by role, not by exact symbol, to survive minor reshaping.
- **Two-serve-mechanism removal:** replacing hand-written `serve-*` with aliases changes behavior for anyone relying on the exact 3-command parallel block; the alias preserves the entry point and the registry-driven path produces an equivalent (corrected) result.
