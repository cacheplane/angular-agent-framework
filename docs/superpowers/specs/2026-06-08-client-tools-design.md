# Client Tools — Frontend-Declared, Frontend-Executed Tools — Design

**Date:** 2026-06-08
**Status:** Draft for review
**Scope:** Add a `client-tools` capability: tools declared in the Angular app (name + description + input schema) that the model can call, where the model's call is routed back to the client to execute — as an async function, a rendered component, or an interactive (HITL) component that emits a result. Spans the render lib, the chat lib, both adapters (`@threadplane/ag-ui`, `@threadplane/langgraph`), a published Python middleware for LangGraph backends, and cockpit examples in both `ag-ui/` and `langgraph/`.

## Goal

Let a frontend author declare tools next to the UI and have the model call them — without a matching backend implementation. The client supplies the tool catalog (name, description, JSON Schema) to the model at run start; when the model calls one, the run ends, the client executes the tool, appends the result as a tool message, and re-runs so the model continues. This complements the existing backend-owned `tool-views` pattern (model calls a backend tool, frontend renders the result); here the tool itself lives on the client.

Three client tool kinds:
1. **Function** — an async handler; its resolved value becomes the tool result.
2. **View** — a component the model fills with props; rendered inline, auto-acknowledged (no user input).
3. **Ask (HITL)** — an interactive component; the value it emits becomes the tool result.

## Non-goals

- Not changing the existing `tool-views` (backend tool → frontend render) pattern; client-tools sits alongside it.
- Not using `interrupt()` — that stays reserved for HITL *approvals*. Client tools unify on end + re-run (see Transport).
- TS middleware for **LangGraph.js** is a documented **fast-follow** (its own spec): no cockpit backend is TS, so it ships unit-tested and externally consumable rather than wired into an example here. This spec ships the **Python** middleware only.

## Background — what exists today

- The model's tool description + schema come solely from the **backend** `@tool` (docstring + typed signature) via `bind_tools`. The frontend `views()` registry is render-only and invisible to the model.
- **AG-UI has native client tools.** `RunAgentInput.tools` (`{ name, description, parameters, metadata }[]`) is passed per-run via `runAgent({ tools })`; there's a `clientProvided` capability flag. The canonical execution loop is **end run → client executes → append `ToolMessage{role:'tool', toolCallId, content}` via `addMessage()` → re-run** with accumulated history. Backend-agnostic.
- **LangGraph SDK has no client-tools field.** Tools are server-side only; but a thread can be continued by re-running with `input:{ messages:[toolMessage] }` (the `add_messages` reducer appends it), so the *same* end + re-run loop applies — no `interrupt()` needed.
- The **render lib** (`@threadplane/render`) is agent-agnostic. `ViewRegistry` entries carry no metadata. Props bind by name to component `input()`s (filtered to declared inputs). A component can `emit(string)` today, routed via an `a2ui:datamodel:` string protocol and `el.on` handlers, surfaced to the host as a `RenderEvent` (`handler`/`stateChange`/`lifecycle`). There is **no typed "this component produced a value" result event**.

## Architecture — four layers

| Layer | Owns | New in this spec |
|---|---|---|
| `@threadplane/render` | component contract: props-schema **in**, result **out** (agent-agnostic) | registry `schema?`+`description?`; typed `injectRenderHost()` (`set`/`emit`/`result`); `RenderResultEvent` |
| `@threadplane/chat` | tool framing + executor + capability type | `tools()` + `action`/`view`/`ask`; the executor; `Agent.clientTools`; JSON-Schema derivation |
| adapters | transport | `clientTools` impl: ship catalog + `resolve` via end+re-run |
| backend | merge catalog → `bind_tools`, end turn on client tool | published Python `client-tools` middleware (LangGraph) |

## Section 1 — Render lib (`@threadplane/render`)

Stays agent-agnostic; gains two generic capabilities.

**1a. Self-describing registry entries.** No backwards-compat constraint.

```ts
interface RenderViewEntry {
  component: Type<unknown>;
  fallback?: Type<unknown>;
  schema?: StandardSchemaV1;   // the component's props contract (Zod/Valibot/ArkType)
  description?: string;        // what this component is (humans + the model)
}
```

Render carries and exposes `schema`/`description`; it does not enforce them on mount (chat validates model args). This makes a component reusable for both `tool-views` and `client-tools`.

**1b. Clean typed output channel (replaces the string `emit`).** The `a2ui:datamodel:<path>:<value>` magic-string parsing is removed. A mounted component injects one typed host object:

```ts
const host = injectRenderHost();
host.set('/seats', 2);            // state write (was a2ui:datamodel:/seats:2)
host.emit('rowClicked', { id });  // named event + typed payload → RenderHandlerEvent
host.result(value);               // component produced a value → RenderResultEvent
```

`RenderEvent` gains:

```ts
interface RenderResultEvent { type: 'result'; value: unknown; elementKey?: string }
```

`handler`/`stateChange`/`lifecycle` remain but are produced through the typed API. Render still knows nothing about tools — `result(value)` only means "this component emitted a value"; chat maps `RenderResultEvent` → tool result.

**Migration:** existing components/specs using the `a2ui:datamodel:` string form (a2ui catalog, any json-render demos) are updated to `host.set(...)`. Inventory + port these as part of the work; no compatibility shim.

## Section 2 — Chat lib (`@threadplane/chat`)

**2a. Declaration API.** `tools({ name: def })` with three named constructors. The object key is the tool name (plain data; minification-safe). Description is the explicit first arg. Arg/prop types infer from the Standard Schema.

```ts
import { tools, action, view, ask } from '@threadplane/chat';

export const myTools = tools({
  get_weather:     action('Look up the weather', WeatherArgs, async (a) => fetchWeather(a)),
  weather_card:    view  ('Show a weather card',  WeatherArgs, WeatherCardComponent),
  confirm_booking: ask   ('Confirm the booking',  BookingArgs, ConfirmBookingComponent),
});
```

- `action(desc, schema, handler)` → function tool; `a` inferred from `schema`.
- `view(desc, schema, Component)` → render-only; model fills props; auto-acks.
- `ask(desc, schema, Component)` → HITL; mounts, awaits `host.result(value)`.

Each constructor returns an opaque `ToolDef`; `tools()` collects them keyed by name. Component constructors (`view`/`ask`) produce a `RenderViewEntry` shape internally so the same component can also feed the `views()` registry.

**2b. Executor.** A chat-lib runner watches `agent.clientTools.pending` for client tool calls (a catalog tool with no backend result after the run ends) and dispatches by kind:

- **function** → validate args against schema; `await handler(args)`; resolve with the return value.
- **view** → mount via render (props = args); auto-resolve with `{ shown: true }`; the card persists in the transcript.
- **ask** → mount; await the `RenderResultEvent`; resolve with its value.
- **error paths** — schema-invalid args, handler throw, user cancel → resolve as a tool *error* (`ToolMessage.error`) so the model can recover.
- **parallel** — collect all pending client results for the turn, then trigger one re-run with all tool messages appended.

**2c. Agent capability.** One optional, transport-agnostic surface:

```ts
interface Agent {
  clientTools?: {
    setCatalog(tools: ClientToolSpec[]): void;            // ship name+description+JSONSchema at run start
    pending: Signal<PendingToolCall[]>;                   // calls awaiting a client result
    resolve(toolCallId: string, result: ToolResult): void;// return result → continue
  };
}
```

`ClientToolSpec = { name; description; parameters: JSONSchema }`. Chat derives `parameters` from the Standard Schema: use Zod's `z.toJSONSchema` when available; allow an explicit `parameters` override for validators without JSON-Schema output. Validation of incoming model args always uses the Standard Schema `validate()`.

## Section 3 — Transport (both adapters implement `clientTools`)

Unified on **end + append `ToolMessage` + re-run**. No `interrupt()`.

| Method | `@threadplane/ag-ui` (any backend) | `@threadplane/langgraph` (direct) |
|---|---|---|
| `setCatalog(tools)` | pass to `runAgent({ tools })` (native `RunAgentInput.tools`) each run | put catalog in run `input`/`config` for the graph middleware to merge |
| `pending` | reducer: catalog tool call with no backend `TOOL_CALL_RESULT` after `RUN_FINISHED` | same — graph ends the turn on a client tool call |
| `resolve(id, result)` | `addMessage({role:'tool',toolCallId,content})` + `runAgent({tools})` | new run with `input:{messages:[toolMessage]}`, same thread |

AG-UI is backend-agnostic — any compliant backend honoring `tools` + tool-message continuation works with no framework code. The reducer gains handling for "run finished with an unresolved catalog tool call" → surface as `pending`.

## Section 4 — Backend: published Python `client-tools` middleware

A real, installable package (not copy-pasted example glue), powering **both** cockpit example backends (the `ag-ui-langgraph`-wrapped one and the direct-LangGraph one — both are Python LangGraph graphs).

Responsibilities:
1. Read the client catalog from run input.
2. Bind each catalog entry as a **stub tool** (name + description + JSON-schema, no execution) on the model alongside server tools.
3. Add a conditional edge: when the model's last message calls a client (stub) tool, route to `END` — pausing the turn so the client executes and re-runs. On the re-run the appended `ToolMessage` is present; the agent node proceeds normally.

Distribution: published to PyPI as `threadplane-client-tools` (exact name TBD). **New publishing infra** — the repo publishes no Python package today, so this adds a PyPI trusted-publishing workflow, versioning, and CI. Follow existing release conventions (patch-only at 0.0.x).

**Fast-follow (separate spec):** a TS middleware targeting **LangGraph.js** with the same responsibilities, for TS/Node LangGraph servers. Not built here.

## Section 5 — Examples, semantics, deliverables

**Cockpit examples** (matching existing capability conventions): `cockpit/ag-ui/client-tools/` and `cockpit/langgraph/client-tools/`, each `python/` + `angular/`, each demoing all three kinds — a `function` tool (e.g., browser geolocation or a client-side lookup), a `view` card, and an `ask` HITL component. Both example backends use the Python middleware. e2e fixtures + specs per example (aimock replay). Registry + manifest wiring (`capability-registry.ts`, ports in `cockpit/ports.mjs`, `assemble-examples` is already registry-driven). A docs guide per the `<Summary>/<Prompt>/<Steps>/<Tip>/<Warning>/<Related>` format.

**Semantics recap:**
- `view` auto-acks (`{ shown: true }`); `ask` resolves via `host.result`; `action` returns its value.
- Args validated against the Standard Schema before invoke; failure → tool error.
- Parallel client tool calls return together in a single re-run.
- A model call to a name that is in the catalog but has no backend impl is what triggers client routing; a name with a backend impl runs server-side as today.

**Deliverables:**
- `@threadplane/render`: `RenderViewEntry` `schema`/`description`; `injectRenderHost()` (`set`/`emit`/`result`); `RenderResultEvent`; port existing `a2ui:datamodel:` usages; unit tests.
- `@threadplane/chat`: `tools()` + `action`/`view`/`ask`; executor; `Agent.clientTools` type; JSON-Schema derivation; unit tests.
- `@threadplane/ag-ui`: `clientTools` impl (native `tools` + `addMessage`/re-run); reducer `pending` detection; unit tests.
- `@threadplane/langgraph`: `clientTools` impl (catalog via input + `ToolMessage` re-run); unit tests.
- Python `client-tools` middleware package + PyPI publishing infra; unit tests.
- Two cockpit examples (ag-ui + langgraph) with e2e + docs guide + registry/manifest/ports wiring.

## Testing strategy

- **Render**: unit tests for registry metadata pass-through, `injectRenderHost` (`set`/`emit`/`result`), `RenderResultEvent` propagation through `RenderSpecComponent.events`; ported `a2ui:datamodel:` cases pass under `host.set`.
- **Chat**: unit tests for `tools()`/constructors (name from key, schema inference), JSON-Schema derivation (Zod + an explicit-override validator), and the executor's four dispatch paths + error/parallel handling against a fake `Agent.clientTools`.
- **Adapters**: unit tests that `setCatalog`/`resolve` produce the right transport calls (AG-UI `runAgent({tools})` + `addMessage`; LangGraph run with appended `messages`); reducer `pending` detection.
- **Python middleware**: unit tests for stub binding + the route-to-END-on-client-tool edge + resume-with-tool-message continuation.
- **e2e**: per example, aimock-replay fixtures covering each of the three kinds end to end through the cockpit shell.

## Open questions / risks

- **PyPI publishing infra** is net-new; sequence it early so the middleware can be consumed by the example backends.
- **`view` auto-ack payload** (`{ shown: true }`) is a convention — confirm it reads acceptably to models in practice during the example e2e.
- **Standard Schema → JSON Schema** only has a first-class path for Zod (`z.toJSONSchema`); other validators rely on the explicit `parameters` override. Documented, Zod preferred in samples.
- **Reducer change** in `@threadplane/ag-ui` to surface "unresolved catalog tool call after run end" must not regress existing backend tool-call handling.

## Phasing (one spec, suggested implementation order)

1. Render lib contract (`schema`/`description`, `injectRenderHost`, `RenderResultEvent`) + port `a2ui:datamodel:` usages.
2. Chat lib `tools()`/constructors + JSON-Schema derivation + `Agent.clientTools` type + executor (against a fake adapter).
3. Python middleware + PyPI publishing infra.
4. `@threadplane/ag-ui` `clientTools` + reducer `pending`.
5. `@threadplane/langgraph` `clientTools`.
6. cockpit `ag-ui/client-tools` example (python + angular + e2e + docs).
7. cockpit `langgraph/client-tools` example (python + angular + e2e + docs).
8. Registry/manifest/ports wiring + full verification.
