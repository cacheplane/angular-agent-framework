# Progressive A2UI Streaming via Parent-LLM Envelope Emission

**Status:** approved (post-spike)
**Date:** 2026-05-12
**Branch:** `claude/spec-genui-streaming-parent-llm`
**Related:** PR #252 (per-component fallback gate), PR #254 (bubble-level skeleton removal), PR #255 (in-place AIMessage replacement + static reorder)

## Goal

Make the per-component fallback transition wired by PR #252 actually visible in the UI by streaming A2UI envelopes from the backend to the frontend as they're generated, rather than delivering the full wrapped payload in one frame. The infrastructure on both sides is already in place — the frontend uses `@cacheplane/partial-json` (`libs/chat/src/lib/streaming/content-classifier.ts`) and the render layer has a per-element readiness gate (`libs/render/src/lib/render-element.component.ts`). What's missing is incremental production on the backend.

## Non-goals

- Changing the `gen_ui_mode='json-render'` path. It emits one monolithic JSON Spec, batch return remains correct.
- Adding new A2UI envelope types or extending v1 protocol.
- Token-level pacing or artificial throttling. Backend yields once per completed envelope (~6-10 per turn).
- Refactoring the `attach_citations` post-processor or the time-travel/checkpoint flows.

## Architectural decision: parent-emits-envelopes (option D)

The current architecture is a two-LLM hop:

```
parent LLM → tool_call(generate_a2ui_schema, args={request}) → ToolNode → sub-LLM call → ToolMessage(envelopes) → emit_generated_surface(reorder, wrap, replace) → AIMessage
```

The new architecture eliminates the sub-LLM. The parent LLM binds a tool whose argument **is** the A2UI envelope array. The system prompt teaches the parent the A2UI v1 schema (~28 KB of prompt text, sourced from `src/schemas/a2ui_v1.py`). As the parent emits the tool_call, its argument tokens stream through LangGraph's chat-model stream events. A callback-handler interceptor sidebands these partial argument tokens as a custom SSE event (`a2ui-partial`) that the frontend subscribes to. ToolNode runs at the end to validate and produce the final ToolMessage; `emit_generated_surface` retains its PR #255 job (reorder + in-place AIMessage replacement) for persistence and replay.

### Why D, not E (sub-LLM custom events)

Spike results from `examples/chat/python/spike/parent_envelope_quality.py` (2026-05-12, gpt-5-mini and gpt-5 against 15 representative prompts) show:

- gpt-5-mini: 93% valid (14/15) after argument-shape normalization
- gpt-5: 80% valid (12/15) after normalization
- Latency parity with today's two-LLM path (~22s mini, ~44s gpt-5)
- All valid outputs produce well-formed A2UI v1 surfaces with 12-24 components

Combined with OpenAI strict-mode tool binding (`bind_tools(..., strict=True)`), residual variance from the gpt-5 positional-key shape is expected to drop to near-zero. Defense-in-depth normalizer catches anything residual.

E (custom events from inside a sub-LLM tool body) was the fallback if D failed. It does not, so E is dropped from scope. The frontend changes designed for D's custom-event bridge are reusable for E should it ever be needed.

### Why custom events, not async-generator nodes

LangGraph supports async-generator nodes that yield multiple state updates. We considered this as an alternative wire shape — `emit_generated_surface` yielding growing AIMessage content via repeated `add_messages` in-place replaces with the same id. We rejected it for two reasons:

1. **The CopilotKit reference (sdk-python/copilotkit) uses metadata-tagged stream interception, not node generators.** Their `PredictState` pattern keeps the message graph clean and uses `adispatch_custom_event` for sideband data. Our spike confirms the same shape works against OpenAI directly.
2. **Replay fidelity.** A node that yields N state updates produces N checkpoints. On replay, the user sees the staircase — but the staircase is artificial (the LLM call has already completed). Custom events are sideband and ephemeral; replay restores final state in one frame from the persisted AIMessage content. This is the correct behavior.

## File-level architecture

### Backend (Python)

```
examples/chat/python/src/
├── graph.py                              [MODIFIED]
├── schemas/
│   └── a2ui_v1.py                        [unchanged — system-prompt source]
└── streaming/                            [NEW directory]
    ├── __init__.py
    ├── envelope_tool.py                  [NEW] Pydantic tool schema + normalizer
    ├── envelope_normalizer.py            [NEW] accept envelopes|envelope|positional|flat
    └── a2ui_partial_handler.py           [NEW] AsyncCallbackHandler that sidebands
                                                  partial tool_call_chunks as a2ui-partial events
```

**`graph.py` changes:**
- Replace `@tool generate_a2ui_schema(request: str)` with `@tool render_a2ui_surface(envelopes: list[dict])` defined in `streaming/envelope_tool.py`. Add structured-output strict mode via `bind_tools([..., render_a2ui_surface], strict=True)`.
- Move `A2UI_V1_SCHEMA_PROMPT` into the parent's SystemMessage (appended to existing `SYSTEM_PROMPT`).
- In `generate`, attach the `A2uiPartialHandler` callback via `config={"callbacks": [...]}`. Handler reads runnable metadata to identify the target tool name and argument key.
- Drop the `gen_ui_mode == "a2ui"` branch's sub-LLM dispatcher. Keep the `json-render` branch as-is.
- `emit_generated_surface` simplifies: read the ToolMessage produced by ToolNode (already-validated envelope list as JSON), apply reorder (PR #255 logic), wrap with `A2UI_PREFIX`, return the in-place AIMessage replacement (PR #255 single-bubble invariant preserved).

**`streaming/envelope_tool.py` (new, ~80 LOC):**
- `class A2uiEnvelope(BaseModel)`: Pydantic schema covering the three envelope variants as optional union fields. Used inside the tool argument type to enable OpenAI strict-mode validation.
- `@tool render_a2ui_surface(envelopes: list[A2uiEnvelope]) -> str`: validates, dumps to JSON. Body is ~10 LOC.
- `normalize_envelope_args(raw_args: dict) -> list[dict] | None`: handles the four observed shapes (`envelopes` key, `envelope` key, positional `{0,1,2,...}`, flat single envelope). Returns canonical list or None.

**`streaming/a2ui_partial_handler.py` (new, ~120 LOC):**
- `class A2uiPartialHandler(AsyncCallbackHandler)`: tracks tool_call_chunks per `tool_call_id`; concatenates argument deltas; dispatches `adispatch_custom_event("a2ui-partial", {tool_call_id, args_so_far})` after each chunk that grows the args string.
- Reads target tool name from runnable metadata key `a2ui:emit_partial.tool` (default `"render_a2ui_surface"`).
- Idempotent: if the same chunk is seen twice, no double-dispatch.

### Frontend (Angular)

```
libs/langgraph/src/lib/
├── agent.ts                              [MODIFIED] expose customEvents() signal
└── streaming/
    ├── custom-events.ts                  [NEW] subscribe to LangGraph custom events
    └── ...

libs/chat/src/lib/
├── a2ui/
│   ├── surface-store.ts                  [MODIFIED] add applyPartialArgs(toolCallId, envelopes)
│   └── partial-args-bridge.ts            [NEW] partial-JSON envelope extractor
└── compositions/
    └── chat/
        └── chat.component.ts             [MODIFIED] subscribe bridge to agent.customEvents()
```

**`@ngaf/langgraph` adapter (~60 LOC delta):**
- Expose a `customEvents: Signal<readonly CustomEvent[]>` on the agent. Buffer events arriving via the LangGraph SDK's event stream (event type matches LangGraph's `on_custom_event` payload).
- Each `CustomEvent` is `{name: string, data: unknown, runId: string}`. The bridge filters by name.

**`partial-args-bridge.ts` (new, ~80 LOC):**
- Per-`tool_call_id` state: cumulative args string, last-parsed envelope index, partial-JSON parser instance (`@cacheplane/partial-json`).
- `push(argsString: string)`: replaces internal buffer (strings grow monotonically; we don't need delta tracking), runs partial-JSON parse, extracts newly-completed envelopes (those whose `surfaceUpdate` / `beginRendering` / `dataModelUpdate` subtree has finished). Each new envelope dispatched to `surfaceStore.apply(env)`.
- Handles all four argument shapes via the same `normalize_envelope_args` mapping (TypeScript port of the Python normalizer; shared test fixtures).
- Synthetic `beginRendering` injection: when first complete `surfaceUpdate` is extracted and no `beginRendering` has arrived yet, synthesize one using `surfaceUpdate.surfaceId` and `surfaceUpdate.root`. Mark synthetic so a real one arriving later is treated as a no-op (idempotent in the store).

**`surface-store.ts` (~10 LOC delta):**
- New entry point: `applyPartialArgs(toolCallId: string, envelopes: readonly A2uiEnvelope[])`. Iterates the input and calls existing `apply()` per envelope. Tracks which `tool_call_id`s have produced live envelopes so the final AIMessage classification path can skip duplicate work.

**`chat.component.ts` (~20 LOC delta):**
- Effect subscribes to `agent.customEvents()`. For events with name `a2ui-partial`, push `data.args_so_far` into the bridge keyed by `data.tool_call_id`. Bridge feeds the surface store.

## Wire format

### Streaming turn (live, first render)

```
SSE  1: on_chat_model_stream → tool_call_chunks delta="..."           # parent LLM streams envelopes as tool args
SSE  2: CUSTOM "a2ui-partial" {tool_call_id: T, args_so_far: "{\"envelopes\":[{\"surfaceUpdate\":..."}
SSE  3: CUSTOM "a2ui-partial" {tool_call_id: T, args_so_far: "...complete surfaceUpdate}, "}
        → frontend: 1st envelope extracted → surface mounts → all components show fallback
        → frontend: synthetic beginRendering injected → surface materializes
SSE  4: CUSTOM "a2ui-partial" {tool_call_id: T, args_so_far: "...{dataModelUpdate1}, "}
        → frontend: component 1 flips from fallback → real
SSE  5..N: more "a2ui-partial" frames → cascade through remaining components
SSE  N+1: tool_call complete (chat-model stream ends)
SSE  N+2: ToolMessage {tool_call_id: T, content: "<final validated JSON>"}
SSE  N+3: messages/partial → AIMessage(id: upstream_ai.id, content: "---a2ui_JSON---\n<reordered>\n", tool_calls: [...])
          → persistence: single-bubble invariant from PR #255; classifier ALSO parses this content,
            but bridge has already marked tool_call_id T as live, so envelope re-application is a no-op
```

### Replay turn (checkpoint restore)

```
SSE 1: messages/partial → AIMessage with full wrapped content
       → classifier parses, surface store applies all envelopes in one tick
       → render-element fallback gate: notReady=false from frame 1 (all bindings already populated)
       → user sees final surface instantly, no staircase
```

This is correct behavior. Replay is meant to restore final state, not reproduce streaming UX.

### Edge: tool_call streamed but no a2ui-partial events arrive (e.g., model emits final args in one chunk)

Frontend bridge sees no events for `tool_call_id T`. Final AIMessage with wrapped content arrives normally; classifier path materializes the surface. Bridge state for T is unused; garbage-collected when the run completes. No user-visible difference except absence of the staircase reveal.

## Argument-shape normalization

Same logic on backend (ToolNode validation) and frontend (partial-args bridge). The four observed shapes from the spike:

| Shape | Example (truncated) | Frequency (mini/gpt-5) |
|---|---|---|
| `{envelopes: [env1, env2, ...]}` | spec-compliant | 6/1 (out of 15) |
| `{envelope: [env1, env2, ...]}` | singular typo | 7/0 |
| `{0: env1, 1: env2, ...}` | positional keys, args treated as the array | 0/11 |
| `{surfaceUpdate: {...}}` | flat single envelope, no wrapper | 1/1 |

Normalizer logic (pseudocode):
```
def normalize(args: dict) -> list[dict] | None:
    if isinstance(args.get("envelopes"), list): return args["envelopes"]
    if isinstance(args.get("envelope"), list):  return args["envelope"]
    keys = list(args.keys())
    if keys and all(k.isdigit() for k in keys):
        return [args[k] for k in sorted(keys, key=int)]
    if any(k in args for k in ("surfaceUpdate", "beginRendering", "dataModelUpdate")):
        return [args]
    return None
```

With OpenAI `strict=True` we expect the LLM to produce only the first shape, but ship the normalizer anyway. ~15 LOC each side.

## Error handling

| Failure | Detection | Recovery |
|---|---|---|
| Parent LLM emits no tool_call (text reply for a UI request) | `not response.tool_calls` in `generate` | Pass through as normal text. No surface rendered. Existing behavior. |
| Tool args unparseable as envelope list (normalizer returns None) | Inside `render_a2ui_surface` tool body | Raise `ValueError`; ToolNode catches and produces a ToolMessage with error content. Frontend classifier sees no A2UI prefix; chat shows text error. |
| Partial-JSON parse error mid-stream (malformed args delta) | Frontend bridge catches | Bridge marks the `tool_call_id` as poisoned and ignores subsequent deltas. Final AIMessage with wrapped content still arrives via the standard messages/partial channel and materializes the surface in one tick. |
| `surfaceUpdate` arrives but `beginRendering` never does (LLM omitted) | Bridge tracks both per surfaceId | Synthetic beginRendering injected on first complete surfaceUpdate. Real one (if it eventually arrives) is idempotent — same surfaceId+root. |
| ToolNode validation fails (Pydantic strict mode) | Pydantic raises | ToolNode produces error ToolMessage. Parent LLM may retry with corrected args (existing LangGraph behavior). |
| Custom event arrives but tool_call_id unknown to surface store | Bridge ignores | Logged at debug level; no user-visible effect. |

## Testing strategy

### Backend (pytest)

```
examples/chat/python/tests/
├── test_envelope_tool.py                 [NEW] schema validation, normalizer 4 shapes, strict mode
├── test_a2ui_partial_handler.py          [NEW] callback handler dispatches custom events, idempotent
└── test_graph_smoke.py                   [MODIFIED] existing tests still pass; new turn-level smoke
                                                     asserts: ≥1 a2ui-partial event per turn; final
                                                     AIMessage has single-bubble shape (PR #255 invariant)
```

Total new test LOC ~150.

### Frontend (vitest)

```
libs/chat/src/lib/a2ui/
├── partial-args-bridge.spec.ts           [NEW] envelope extraction, synthetic beginRendering,
                                                  shape normalization, poisoned tool_call_id
└── surface-store.spec.ts                 [MODIFIED] applyPartialArgs entry point

libs/langgraph/src/lib/
└── streaming/custom-events.spec.ts       [NEW] custom-event subscription, signal emission
```

Total new test LOC ~120.

### Integration / live smoke

A second pytest smoke that runs the graph against a recorded LLM stream fixture (saved from a real OpenAI call) and asserts:
- ≥3 `a2ui-partial` events dispatched for a representative prompt
- Final state has 1 AIMessage with `---a2ui_JSON---` wrapped content
- ToolMessage with normalized envelope JSON exists

No mock-LLM in the unit tests for streaming behavior — they use a stub callback handler driver. The fixture-based pytest exercises the real handler against canned stream chunks.

### Manual smoke (Chrome MCP)

Trigger a GenUI prompt at `http://localhost:4200/embed`. Sample DOM via `requestAnimationFrame` over the full turn. Capture frames where `render-default-fallback` count > 0 — those frames now exist because partial envelopes arrive over time.

## Scope decomposition (three independent PRs)

| PR | Branch | Scope | LOC | Depends on |
|---|---|---|---|---|
| **1. Frontend custom-event bridge** | `claude/genui-streaming-frontend-bridge` | `@ngaf/langgraph` exposes `customEvents()`; partial-args bridge; `surface-store.applyPartialArgs`; chat composition subscribes. Tests use fake event source. | ~180 LOC + tests | — |
| **2. Backend envelope-tool + normalizer** | `claude/genui-streaming-envelope-tool` | New `streaming/` directory in Python; replace `generate_a2ui_schema` with `render_a2ui_surface`; move A2UI prompt into parent SystemMessage; ToolNode + strict mode; emit_generated_surface simplified. No custom events yet. | ~150 LOC + tests | — |
| **3. Backend a2ui-partial handler** | `claude/genui-streaming-partial-handler` | `A2uiPartialHandler` callback; attach to `generate` node; dispatch via `adispatch_custom_event`. Wire-format smoke test. | ~120 LOC + tests | 2 |

PRs 1 and 2 can ship in either order without changing user-visible behavior (PR 2 alone still works via the existing batch path; PR 1 alone just doesn't receive any events). PR 3 completes the picture. Total: ~450 LOC + ~270 LOC tests.

## Out of scope (explicit non-goals)

- **`gen_ui_mode='json-render'`** — single JSON Spec; partial-JSON streaming would require a different bridge. Stays batch.
- **Multi-surface streaming.** PR #255's static reorder already handles `begin_renderings[1:]` for trailing surfaces. Bridge handles them via per-surfaceId state in the store. Not a special case.
- **Replacing time-travel/checkpoint replay UX.** Replay continues to materialize surfaces in one tick from persisted AIMessage content. Streaming staircase is live-only.
- **Token-level pacing.** The LLM streams at its natural rate. Backend yields once per chunk that grows args; no artificial throttling.

## Risk register

- **Strict-mode argument shape coverage.** Spike was run without `strict=True`. Production should retest after adding it; if residual variance persists, the normalizer is the safety net but it's worth measuring the actual delivery rate.
- **Latency parity.** Today's two-LLM path averages ~22s for gpt-5-mini. D's single-LLM path matches because the work moved into the parent. No latency win, only a streaming UX win. Acceptable.
- **System-prompt bloat.** A2UI v1 schema is ~28 KB. Parent's prompt grows accordingly. Token cost per turn rises by roughly the same amount as the current sub-LLM's system prompt cost (which was also ~28 KB), so net token spend is comparable.
- **Custom-event channel reliability.** LangGraph SDK's event stream is best-effort under network conditions. Bridge degrades gracefully: any dropped event just means the final classification path catches up.
- **Render-element latch coupling.** PR #252's monotonic latch in `<render-element>` means once a component has mounted real, a later fallback re-request is ignored. With streaming, an out-of-order envelope (dataModelUpdate before surfaceUpdate is fully processed) could in theory cause a brief mount-then-replace. Mitigation: bridge applies envelopes in arrival order, which the partial-JSON parser guarantees follows the LLM's emission order. Tested.
- **Argument-shape regression with future model versions.** If OpenAI changes structured-output behavior, the spike rates may shift. Mitigation: normalizer covers known shapes; new shapes get added there.
