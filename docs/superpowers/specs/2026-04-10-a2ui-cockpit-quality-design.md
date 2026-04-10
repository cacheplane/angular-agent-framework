# A2UI Cockpit Example — Production Quality Pass

## Goal

Make the A2UI cockpit example production-ready: register it in the cockpit system, fix library and documentation issues, convert to LLM-backed agent, ensure e2e coverage.

## Current State

The A2UI example exists at `cockpit/chat/a2ui/` with Angular frontend and Python backend, but is not wired into the cockpit's routing, navigation, serve infrastructure, or e2e test suite. The graph hardcodes form JSONL instead of using an LLM. The system prompt has inaccurate prop names. The agent sends `_bindings` explicitly (should be auto-populated by `surfaceToSpec`).

## Changes

### 1. Library Fix: `surfaceToSpec` RESERVED_KEYS

**File:** `libs/chat/src/lib/a2ui/surface-to-spec.ts`

Add `_bindings` to `RESERVED_KEYS` set. Currently agent-authored `_bindings` leaks through as a regular prop before being overwritten by auto-detected bindings. With this fix, `_bindings` from the agent is filtered out — only the auto-detected bindings are set.

Update existing test in `surface-to-spec.spec.ts` to verify `_bindings` from agent input is not passed through as a regular prop.

### 2. Register A2UI in Cockpit

Four registration points, following the pattern of the 30 existing capabilities:

- **`libs/cockpit-registry/src/lib/manifest.ts`** — add `'a2ui'` to `APPROVED_TOPICS.chat['core-capabilities']`
- **`apps/cockpit/scripts/capability-registry.ts`** — add `{ id: 'c-a2ui', product: 'chat', topic: 'a2ui', angularProject: 'cockpit-chat-a2ui-angular', port: 4511, pythonDir: 'cockpit/chat/a2ui/python', graphName: 'c-a2ui' }`
- **`apps/cockpit/src/lib/route-resolution.ts`** — import `chatA2uiPythonModule` from `cockpit/chat/a2ui/python/src/index` and add to `capabilityModules` array
- **`apps/cockpit/e2e/all-examples-smoke.spec.ts`** — add `{ name: 'c-a2ui', port: 4511, selector: 'app-a2ui' }`

### 3. Fix Port & Graph Name Convention

The dev environment uses port 4311 (conflicts with `filesystem`). The graph name `a2ui_form` doesn't follow the `c-{topic}` convention used by all other chat capabilities.

- **`environment.development.ts`** — change `langGraphApiUrl` to `http://localhost:4511/api`
- **`environment.ts`** — change `a2uiAssistantId` to `c-a2ui`
- **`environment.development.ts`** — change `a2uiAssistantId` to `c-a2ui`
- **`langgraph.json`** — rename graph key from `a2ui_form` to `c-a2ui`

### 4. LLM-Backed Graph

Replace hardcoded JSONL with LLM-backed generation, matching the `generative-ui` pattern:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

async def generate(state: MessagesState) -> dict:
    system_prompt = (PROMPTS_DIR / "a2ui.md").read_text()
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)
    return {"messages": [response]}
```

Single `generate` node → END. The system prompt provides the A2UI protocol reference so the LLM generates valid A2UI JSONL.

### 5. Fix System Prompt (a2ui.md)

Correct all inaccuracies against actual component implementations:

| Current (wrong) | Correct |
|-----------------|---------|
| `Text.content`, `Text.variant` | `Text.text` (no variant) |
| `Row.gap` | Remove (no gap prop) |
| Missing validation/checks | Add `checks` array documentation |
| Missing `sendDataModel` | Add to `createSurface` docs |
| No `_bindings` instruction | Agents must NOT send `_bindings` — auto-populated |
| `DateTimeInput.type` | `DateTimeInput.inputType` with values `date`, `time`, `datetime-local` |

### 6. Fix guide.md

- Remove `_bindings` from the JSON example in step 4
- Fix the "updates automatically via StateStore" claim — clarify this is a known limitation (data model updates from user input do not reflect to other components in real time)

### 7. E2E Test

Expand `cockpit/chat/a2ui/angular/e2e/a2ui.spec.ts` to match `all-examples-smoke.spec.ts` pattern:
- Verify `app-a2ui` selector attached
- Verify `chat` component visible
- Verify input and send button exist
- Use port 4511

## Out of Scope

- Adding angular() vite plugin for TestBed tests (known infrastructure limitation)
- StateStore integration for data model binding (Phase 3+)
- Production smoke tests (separate CI concern)

## Success Criteria

- A2UI appears in cockpit navigation under Chat > Core Capabilities > A2UI
- `serve-example.ts --capability=c-a2ui` works
- `all-examples-smoke.spec.ts` includes A2UI
- Graph uses LLM to generate A2UI JSONL dynamically
- System prompt matches actual component API
- `_bindings` is in RESERVED_KEYS — library correctness
- All existing tests pass (300+)
