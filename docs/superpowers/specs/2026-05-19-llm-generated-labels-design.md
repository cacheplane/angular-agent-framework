# LLM-Generated Labels — Design

**Date:** 2026-05-19
**Status:** Spec — pending implementation plan

## Goal

Stop hardcoding user-facing labels in chat primitives and stop pretending non-LLM heuristics (regex/slice of the first user message) are "labels." Two concrete fixes, one design pass:

1. **Thread titles** — replace the missing/sliced fallback with a small LLM call (cheap model, fires after first turn, writes to LangGraph thread metadata) so the sidenav shows meaningful titles like *"Flight LAX to JFK"* instead of UUIDs or 50-char prompt slices.

2. **Action message labels** — remove the `KNOWN_LABELS` map added in PR #464 (which embedded app-specific action names like `bookingSubmit → "Search flights"` inside the chat library). Instead, derive the bubble label from the **already-LLM-authored source element** (the Button's child Text component). The protocol carries the machine name; the rendering layer humanizes from authored UI, not from a hardcoded map.

## Research basis

Research subagent surveyed LangChain/LangGraph, Vercel AI SDK, assistant-ui, CopilotKit/AG-UI, and the ChatGPT/Claude reference UX. Cross-cutting consensus:

- **Thread title generation**: triggered after first AI turn, runs out-of-band, uses a cheap dedicated model (Haiku-class / gpt-4o-mini), persisted in thread metadata. Slicing the first user message is universally treated as a fallback only.
- **Action labels**: the tool/component author supplies the human label at definition time. The protocol carries the machine name; the rendering layer humanizes. **Nobody hardcodes a per-app `KNOWN_LABELS` map in the chat primitive itself.** AG-UI explicitly states "consumers should translate `getBookedFlights` → 'Determining booked flights…' in the UI" — i.e. the rendering layer humanizes from authored metadata, not from a centralized string table in the lib.

Today's codebase violates both. This spec fixes them.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Per-cap independence is non-negotiable | Each chat capability stays self-contained: own `pyproject.toml`, own `src/`, no cross-cap python imports. Per-cap migration (PR #413) established this; we don't undo it. |
| 2 | Where the title-generation logic lives | **Fully inline in each cap's `graph.py`** — node definition + LLM call mechanics + SDK write, all visible in one file. Cost: ~30 lines duplicated per cap. Benefit: a developer studying the cap reads ONE file and sees everything the agent does. Matches the cap's pedagogical purpose. |
| 3 | When the title node fires | Conditional edge after the cap's terminal node (typically `respond`). Skips when thread metadata already has `thread_title` (idempotent). Triggered on first AI turn only. |
| 4 | Title-generation model | `gpt-5-mini` per-cap default. Each cap can override (e.g. c-a2ui can use gpt-5 if it wants schema-aware titles). |
| 5 | Title prompt | Short and prescriptive: *"In 3-5 words, summarize what the user is asking about. Output ONLY the title — no quotes, no period, no prefix."* Matches Vercel's pattern. |
| 6 | Title persistence | LangGraph SDK `client.threads.update(thread_id, metadata={"thread_title": title})`. First-class metadata field on `Thread`. |
| 7 | Title failures | Swallowed (title is a UX nicety, never a blocker). The cap's main flow returns normally even if title gen errors. |
| 8 | Action label source | The **source Button's child Text** — already authored by the LLM as part of the surface spec. `libs/chat/src/lib/a2ui/build-action-message.ts` looks up `sourceComponentId` in the surface, walks to the Button's `child` (Text id), reads its `literalString`, and stamps it on the outgoing `A2uiActionMessage.action.label`. |
| 9 | Action label fallback | When the source component isn't a Button-with-Text-child (e.g. CheckBox toggle, MultipleChoice selection, Modal action), fall back to camelCase humanization of `action.name`. Preserves PR #464's behavior for those cases. |
| 10 | Kill `KNOWN_LABELS` | The hardcoded map in `libs/chat/src/lib/a2ui/action-label.ts` is removed. Chat-lib stops knowing about specific app actions. |
| 11 | Frontend → backend wire compatibility | `action.label` is a new optional field on `A2uiActionMessage.action`. Backends that ignore it continue to work; backends that want to use it (e.g. for routing or logging) can read it. |
| 12 | Scope of this PR | **c-a2ui first** (the cap that exercises both surfaces most thoroughly). Pattern documented for other caps to adopt. No bulk migration. |

## Architecture overview

### Half 1 — Thread titles (Pattern D: inline node, per-cap)

```
START → agent ↔ tools → respond → should_title ┬─→ generate_title → END
                                                └────────────────── END  (already titled, or no thread_id)
```

`generate_title` is a normal LangGraph node in the cap's graph builder. It:
1. Reads `config.configurable.thread_id`
2. Calls SDK `client.threads.get(thread_id)`; bails if `metadata.thread_title` exists
3. Walks `state["messages"]` for the first human message
4. Invokes a cheap LLM with the title prompt
5. Writes via `client.threads.update`
6. Returns `{}` (no state change)

`should_title` is a conditional edge function on `respond` that returns `"generate_title"` only on first turn, `END` otherwise. (Could also be unconditional — generate_title's own idempotency check covers re-fires. Simpler: unconditional edge, idempotency in the node.)

### Half 2 — Action labels (derive from authored UI)

```
[Surface render time]
LLM authors Button → child Text component with literalString = "Search flights"

[User clicks button]
build-action-message.ts
  ├─ resolves sourceComponentId → Button component in the surface
  ├─ reads Button.child → Text id
  ├─ reads Text.text.literalString → "Search flights"
  └─ stamps `action.label = "Search flights"` on the outgoing message

[Rendering the user bubble in the transcript]
chat.component.ts → humanContent(message)
  ├─ a2uiActionLabel(content) parses the action message
  ├─ returns `action.label` if present  (← the new path)
  └─ else humanizes camelCase action.name
```

No KNOWN_LABELS table. The Button author (the LLM) is the source of truth for what to call the action.

## Files modified

### Python (per-cap, fully inline)

- `cockpit/chat/a2ui/python/src/graph.py`
  - Add `generate_title` node (~25 lines: helper-free LLM call + SDK write)
  - Add unconditional edge `respond → generate_title → END`
  - No new imports outside what's already there + `langgraph_sdk.get_client`

### TypeScript (chat-lib, centralized)

- `libs/a2ui/src/lib/types.ts`
  - Add optional `label?: string` to `A2uiActionMessage['action']`
- `libs/chat/src/lib/a2ui/build-action-message.ts`
  - Accept the surface (already passed); look up the source Button → Text child; stamp `action.label` when found
- `libs/chat/src/lib/a2ui/action-label.ts`
  - Prefer `action.label` when present
  - **Remove `KNOWN_LABELS`** — leave only the camelCase humanizer as fallback
  - Keep the public `a2uiActionLabel(content: string): string | null` signature unchanged

### Frontend wiring (already supported)

- `libs/chat/src/lib/primitives/chat-thread-list/...` — already reads `Thread.title`. No change.
- LangGraph SDK adapter — sources `Thread.title` from `thread.metadata.thread_title`. Need to verify this mapping happens already; if not, one-line patch in the langgraph adapter.

## Implementation detail — the c-a2ui `generate_title` node (fully inline)

```python
# In cockpit/chat/a2ui/python/src/graph.py — added near other nodes

from langgraph_sdk import get_client

_TITLE_PROMPT = (
    "In 3-5 words, summarize what the user is asking about. "
    "Output ONLY the title — no quotes, no period, no prefix."
)


async def generate_title(state: MessagesState, config) -> dict:
    """Background title generation: on the first turn, summarize the user's
    intent into 3-5 words and persist to LangGraph thread metadata so the
    sidenav shows something meaningful instead of a UUID slice.

    Idempotent — skips when metadata.thread_title already exists. Errors
    are swallowed (title is a UX nicety, never a blocker). Runs after
    `respond` so the user-visible turn is never blocked by title gen.
    """
    thread_id = (config.get("configurable") or {}).get("thread_id")
    if not thread_id:
        return {}
    try:
        client = get_client(url="http://localhost:2024")  # cockpit dev default
        thread = await client.threads.get(thread_id)
        if (thread.get("metadata") or {}).get("thread_title"):
            return {}
        first_user = next(
            (m for m in state["messages"] if getattr(m, "type", None) == "human"),
            None,
        )
        if not first_user or not isinstance(first_user.content, str):
            return {}
        # Skip action-message JSON (those flow as human-role too)
        if first_user.content.lstrip().startswith("{"):
            return {}
        llm = ChatOpenAI(model="gpt-5-mini", temperature=0)
        response = await llm.ainvoke([
            SystemMessage(content=_TITLE_PROMPT),
            HumanMessage(content=first_user.content),
        ])
        title = (response.content or "").strip().strip('"').strip("'")[:80]
        if title:
            await client.threads.update(thread_id, metadata={"thread_title": title})
    except Exception as err:
        _logger.warning("Thread title generation failed: %s", err)
    return {}
```

Wired in the builder:

```python
_builder.add_node("generate_title", generate_title)
_builder.add_edge("respond", "generate_title")
_builder.add_edge("generate_title", END)
# (remove the prior `_builder.add_edge("respond", END)`)
```

## Implementation detail — action label derivation

### `libs/a2ui/src/lib/types.ts`

```typescript
export interface A2uiActionMessage {
  version: 'v1';
  action: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context: Record<string, unknown>;
    /** Optional human-friendly label for the action — typically derived
     *  from the source component's authored text (e.g. a Button's child
     *  Text literalString). Set by `buildA2uiActionMessage` when the
     *  source is a Button-with-Text-child; left undefined otherwise.
     *  Used by the chat-lib's transcript renderer to label the user
     *  bubble; backends may ignore. */
    label?: string;
  };
  metadata?: { a2uiClientDataModel: A2uiClientDataModel };
}
```

### `libs/chat/src/lib/a2ui/build-action-message.ts`

```typescript
export function buildA2uiActionMessage(
  params: Record<string, unknown>,
  surface: A2uiSurface,
): A2uiActionMessage {
  const rawContext = (params['context'] as Record<string, unknown>) ?? {};
  const wrappedContext: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawContext)) {
    wrappedContext[k] = toDynamicValue(v);
  }

  const sourceComponentId = params['sourceComponentId'] as string;

  const message: A2uiActionMessage = {
    version: 'v1',
    action: {
      name: params['name'] as string,
      surfaceId: surface.surfaceId,
      sourceComponentId,
      timestamp: new Date().toISOString(),
      context: wrappedContext,
    },
  };

  // NEW: derive label from the source component when it's a Button with
  // a Text child. The Text was authored by the LLM as part of the surface
  // spec; reuse it as the action's display label.
  const label = deriveActionLabel(surface, sourceComponentId);
  if (label) message.action.label = label;

  if (surface.sendDataModel) {
    message.metadata = {
      a2uiClientDataModel: {
        version: 'v1',
        surfaces: { [surface.surfaceId]: surface.dataModel },
      },
    };
  }
  return message;
}

function deriveActionLabel(surface: A2uiSurface, sourceId: string): string | null {
  const source = surface.components.get(sourceId);
  if (!source) return null;
  const buttonProps = (source.component as { Button?: { child?: string } }).Button;
  if (!buttonProps?.child) return null;
  const labelText = surface.components.get(buttonProps.child);
  if (!labelText) return null;
  const textProps = (labelText.component as { Text?: { text?: { literalString?: string } } }).Text;
  return textProps?.text?.literalString ?? null;
}
```

### `libs/chat/src/lib/a2ui/action-label.ts`

```typescript
// KNOWN_LABELS map is REMOVED entirely.

export function a2uiActionLabel(content: string): string | null {
  // ... parsing identical to today ...

  // NEW: prefer the authored label that was stamped at emit time.
  if (typeof action['label'] === 'string' && action['label'].length > 0) {
    return action['label'];
  }

  // FALLBACK: humanize camelCase (unchanged from PR #464).
  return humanizeCamelCase(name);
}
```

## Testing

### Unit tests (chat-lib)

- `build-action-message.spec.ts`:
  - Button-with-Text-child source → `action.label` populated
  - Source with no Button → `action.label` undefined
  - Source with Button but no child Text id → `action.label` undefined
  - Surface that doesn't have the sourceComponentId at all → `action.label` undefined (graceful)
- `action-label.spec.ts`:
  - Action with `label` → returns that label verbatim
  - Action without `label` → falls back to camelCase humanizer
  - Verify NO KNOWN_LABELS lookup happens (use a name like `bookingSubmit` that PR #464's map would have hit → now returns `"Booking submit"`, not `"Search flights"`)

### Integration / real-LLM smoke (c-a2ui)

- 3-turn programmatic smoke against per-cap on :5511:
  1. First turn: `'I want to fly LAX to JFK'` → after `respond` completes, eventually `thread.metadata.thread_title` exists and is non-empty (~3-5 words)
  2. Second turn (same thread): `'Filter to cancelled flights'` → title is NOT overwritten (idempotency)
  3. Verify the action message emitted by the form's Search button carries `action.label = "Search flights"` (the LLM-authored Button text)

### Chrome MCP smoke

- Open c-a2ui at `:4511`
- Send first prompt via chip → wait for response → check sidenav: thread shows generated title (not UUID)
- Submit form → user bubble shows `"Search flights"` derived from the authored Button text (not from the removed KNOWN_LABELS map)

## Risks and mitigations

- **Title-gen blocks a CI test that asserts thread metadata is empty.** Mitigation: the node is unconditional but idempotent; tests can pass a thread_id whose metadata they don't check, or skip the metadata assertion.
- **`get_client(url=...)` hardcodes the dev URL.** Mitigation: read from `LANGGRAPH_API_URL` env with fallback to `http://localhost:2024`. Inline this in the node body (matches the inline pattern — no hidden config).
- **LLM occasionally emits a title in quotes or with a period.** Mitigation: strip both at the call site (`.strip().strip('"').strip("'")[:80]`). Done in the snippet above.
- **`get_client()` creates a new client per invocation.** Acceptable for the cockpit demo's throughput. If profiling shows it as hot, switch to a module-level cached instance.
- **Action label derivation only handles Button source today.** Acceptable: Buttons account for ~all form-submit and card-action interactions in our surfaces. CheckBox/MultipleChoice/Slider don't have a single text label that maps 1:1 to the action; humanized camelCase is a fine fallback for them.
- **Breaking change for any external consumer relying on `KNOWN_LABELS` behavior** (e.g. `bookingSubmit` → `"Search flights"` was hardcoded; now becomes `"Booking submit"` unless the Button is authored with that text). Mitigation: any LLM authoring a booking form already writes the Button's text as `"Search flights"`; the derivation reads that. So the visible bubble is unchanged in practice. PR #464 itself was only ~24 hours old at spec time.
- **`label` field on the wire**: if any agent ignores unknown fields strictly, this could break it. LangChain's BaseMessage shape passes through unknown JSON properties fine. Mitigation: documented in the field's docstring.

## Out-of-scope follow-ups

- Roll out to other cockpit caps (c-generative-ui, c-tool-calls, c-subagents, c-interrupts, ...). Each follows the same inline pattern. Done one at a time, separate PRs.
- Title regeneration policy when thread is renamed by the user or after N turns. Today: write-once-on-first-turn. Future: opt-in re-summarization triggered by a heuristic.
- Pluggable title model selection per-cap (today: hardcoded to `gpt-5-mini` in the node body). Each cap can edit its own constant; no centralization needed yet.
- Action label derivation for non-Button sources (CheckBox label, Slider label, MultipleChoice options). Each requires a different DOM walk; ship one when a real use case appears.
- Consider extracting the title call mechanics to a narrow utility if duplication across caps becomes painful (target: 3+ caps doing it inline before extracting). Not now — we want to see real cap usage patterns first.
- Cleanup: when c-a2ui is the proof point, the other caps can adopt the pattern in batches. No central scheduler / migration plan needed today.

## Self-review

**Spec coverage:** both fixes (titles + labels) are addressed. Pattern D (inline) is locked in for titles. KNOWN_LABELS removal + derivation-from-authored-UI is locked in for labels.

**Placeholder scan:** all code snippets are complete and runnable; no TBDs. Models, prompts, paths, and signatures are concrete.

**Type consistency:**
- `A2uiActionMessage.action.label?: string` — new optional field. `a2uiActionLabel` returns `string | null` (unchanged signature). `deriveActionLabel` returns `string | null`. Consistent.
- `generate_title` is an async LangGraph node taking `(state: MessagesState, config)`, returning `dict`. Matches LangGraph's expected node signature.
- `_builder.add_edge("respond", "generate_title")` — both are node names registered earlier in the file. Consistent.

**Anti-pattern check:** zero hardcoded label tables. Zero topology magic. Zero cross-cap python imports. Each cap stays self-contained.

---

## Addendum 2026-05-21 — converged on `metadata.title`

This spec proposed `metadata.thread_title` for the new cockpit-cap title nodes (c-threads, c-a2ui). After landing #481, #488, #491, #492, #493 the per-cap key created friction:

- `LangGraphThreadsAdapter` carried a `titleMetadataKey` config knob to bridge the two conventions
- Each consumer had to remember which spelling its backend used
- The canonical demo (`examples/chat/python`) writes `metadata.title` and predates this spec

Resolved by converging on `metadata.title` across all consumers:

- `cockpit/chat/threads/python` + `cockpit/chat/a2ui/python` graphs now write `metadata.title`
- `LangGraphThreadsAdapter` reads `metadata.title` unconditionally; the `titleMetadataKey` config knob is gone
- Pre-existing prod threads written with the old `thread_title` spelling would lose their title; the existing prod backlog was cleared separately (see /tmp/delete-prod-threads.sh)

Pattern D (inline node per cap, no shared helper) stays intact — only the metadata key name changes.
