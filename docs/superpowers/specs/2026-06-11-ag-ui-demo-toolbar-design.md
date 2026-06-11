# examples/ag-ui — Canonical Demo Toolbar Parity

**Date:** 2026-06-11
**Status:** Design / spec
**Scope:** `examples/ag-ui/angular` (frontend port), `libs/ag-ui` (one small adapter feature). No python/graph changes expected (verify step included). Approach A from brainstorming: port the canonical demo-shell pattern, trimmed; examples stay standalone (duplicate, don't share).

---

## Goal

Replace the AG-UI example's static header ("AG-UI Chat / The Threadplane chat UI over the AG-UI transport") with the **canonical demo's toolbar**, at full functional parity where the transport allows:

- **Mode segmented control** — Embed / Popup / Sidebar (each a route rendering a different chat composition).
- **Model / Effort / Gen-UI / Theme selects** (`chat-select`), identical options to the canonical demo.
- **Dark/light toggle** — relocated into the toolbar's right side (canonical hosts it in the threads-sidenav footer, which this example doesn't have).
- **URL knobs + localStorage persistence** for all surviving controls.
- **Welcome-suggestion chips** in each mode's empty state (the canonical prompt list — every prompt works against this example's graph, which is a copy of chat's).

## Why this is now small

The canonical demo does NOT use LangGraph-specific config for the Model/Effort/Gen-UI knobs. It wraps `agent.submit` and merges `{model, reasoning_effort, gen_ui_mode}` into the **neutral contract's `input.state`** (`AgentSubmitInput.state`), and the graph reads those keys from **state** (`state.get("reasoning_effort")`, etc.). The AG-UI example's python graph is a copy of the same graph — it already reads these keys. The only missing plumbing is that the AG-UI adapter's `submit()` currently ignores `input.state`.

---

## Part 1 — Adapter: forward `input.state` (`libs/ag-ui`)

`libs/ag-ui/src/lib/to-agent.ts` `submit()`:

- When `input.state` is present, merge it into the AG-UI source agent's client state so it is carried on the run input (AG-UI `RunAgentInput.state` — the same channel the shared-state/json-render examples use server→client, used client→server here).
- Apply on **both** paths: the normal submit path and the resume path (`input.resume` + `input.state` may be combined per the contract).
- Also optimistically merge into the local `store.state` signal so `agent.state()` reflects what was sent (the server's next `STATE_SNAPSHOT` remains authoritative).

Unit tests beside the existing adapter specs: state forwarded on submit; state forwarded on resume; no state → unchanged behavior; local `state()` reflects the merge.

**Verify-first spike (before frontend work):** against the local uvicorn backend, send `input.state = { reasoning_effort: 'high' }` and confirm the graph observes it (e.g. via the run's behavior or a debug log). Expected to work because `ag-ui-langgraph` merges `RunAgentInput.state` into graph input. **Fallback if it doesn't:** keep the adapter API the same but carry the patch via `forwardedProps.state` and map it into graph input in `examples/ag-ui/python/src/server.py` — contained in the same PR.

## Part 2 — Frontend: `ag-ui-shell` (examples/ag-ui/angular)

Copy-and-trim the canonical `examples/chat/angular/src/app/shell/demo-shell.component.*` into `examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.*` (house rule: examples are standalone; no cross-example imports):

**Toolbar (replaces the current header):**
- Segmented Mode control (Embed/Popup/Sidebar) — same markup/classes as canonical.
- `chat-select` fields: Model, Effort, Gen UI, Theme — same option lists as canonical (`modelOptions`, `effortOptions`, `genUiOptions`, `themeOptions`).
- Dark/light scheme toggle button (sun/moon SVG, same as canonical's) placed at the toolbar's right edge.

**Routing (new — the app currently has none):**
- Add the Angular router. Routes: `''` → redirect `/embed`; `/embed`, `/popup`, `/sidebar` each render a ported mode component (copied from `examples/chat/angular/src/app/modes/`), bound to `[agent]` and `[views]`.
- Port `welcome-suggestions.ts` + `WelcomeSuggestionsComponent` unchanged.
- `/` redirecting to `/embed` keeps the existing e2e helper (`openDemo(page, '/')`) and all 10 current specs working without changes.

**Agent wiring:**
- Keep `injectAgent()` + `a2uiBasicCatalog()`. Wrap `submit` exactly like the canonical shell: merge `{ model, reasoning_effort, gen_ui_mode }` from the toolbar signals into `input.state` on every send.
- The existing interrupt-panel region (`@if (agent.interrupt && agent.interrupt())` → `<chat-interrupt-panel>`) moves into the shell's main region, unchanged.

**Persistence:**
- Port the canonical localStorage persistence service and URL-knob sync, trimmed to the surviving keys: `mode` (via route), `model`, `effort`, `genui`, `theme`, color scheme. Same precedence as canonical (URL > stored > default; defaults omitted from the URL).
- Theme reflection: set `data-theme` / `data-threadplane-chat-theme` on `<html>` exactly as canonical does (including the default-light/dark auto-sync behavior).

**Trimmed out (explicitly NOT ported):** threads sidenav + scrim + hamburger, history search palette, projects, new-chat, archived threads, subagents region (the AG-UI adapter exposes no `subagents` signal), chat-debug, thread-id URL/routing.

## Part 3 — Out of scope

- No thread CRUD / multi-conversation anything (transport doesn't offer it; single conversation remains a deliberate property of this example).
- No python/graph changes (unless the Part-1 fallback triggers, which adds only a small `server.py` mapping).
- No website/homepage changes; the deployed demo updates via the existing `ag-ui demo → Vercel` CI path on merge.

## Risks / verify items

1. **State→graph plumbing** (Part 1 spike). Fallback defined above.
2. **`gen_ui_mode=json-render` over AG-UI:** the graph picks `generate_json_render_spec` and the chat composition renders json-render specs from tool results — transport-neutral in principle; verified manually during implementation. If broken, ship the select anyway, file the gap as an issue, and note it in the example README (don't fake it).
3. **E2E stability:** the `/`→`/embed` redirect must keep all 10 existing specs green unchanged; mode components and suggestions render against aimock fixtures exactly as in examples/chat.

## Testing

- **Adapter:** unit tests listed in Part 1 (`nx test ag-ui`).
- **Example e2e:** existing 10 specs green unchanged; new specs: (a) mode switch — `/popup` and `/sidebar` render their compositions (toolbar click updates route + composition mounts); (b) toolbar state — pick `Effort = high`, send a fixture prompt, assert the run proceeds (and, if cheaply assertable via aimock request capture, that the LLM request reflects the knob); (c) URL knob — load `/embed?effort=high` and assert the select reflects it.
- **Local manual verification** (Chrome, like today): toolbar renders; modes switch; selects persist across reload; dark/light toggles; approval + a2ui still work.
- **Lint/build:** `nx lint ag-ui`, `nx test ag-ui`, `nx lint examples-ag-ui-angular`, `nx build examples-ag-ui-angular`.

## Decomposition (for the plan)

1. Spike + adapter: `input.state` forwarding + unit tests (and fallback decision).
2. Shell scaffold: routing + mode components + welcome suggestions (toolbar mode control only).
3. Toolbar selects + submit wrapper + persistence/URL knobs + theme/scheme.
4. E2E: keep 10 green; add the 3 new specs.
5. PR (single), merge on green; verify deployed demo.
