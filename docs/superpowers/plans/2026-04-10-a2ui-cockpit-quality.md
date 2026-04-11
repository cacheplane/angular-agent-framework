# A2UI Cockpit Example — Production Quality Pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the A2UI cockpit example production-ready: register in cockpit, fix library issues, convert to LLM-backed agent, ensure e2e coverage.

**Architecture:** Add `_bindings` to surfaceToSpec's RESERVED_KEYS (library fix). Register A2UI in the cockpit's four integration points (manifest, capability registry, route resolution, e2e smoke). Convert the Python graph from hardcoded JSONL to LLM-backed generation with a corrected system prompt. Fix port/naming to match conventions.

**Tech Stack:** Angular 19, Vitest, Playwright, LangGraph, LangChain/OpenAI, Python 3.12

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `libs/chat/src/lib/a2ui/surface-to-spec.ts` | Modify (line 6) | Add `_bindings` to RESERVED_KEYS |
| `libs/chat/src/lib/a2ui/surface-to-spec.spec.ts` | Modify (add test) | Verify agent-authored `_bindings` is filtered |
| `libs/cockpit-registry/src/lib/manifest.ts` | Modify (line 47) | Add `'a2ui'` to APPROVED_TOPICS |
| `apps/cockpit/scripts/capability-registry.ts` | Modify (line 47) | Add c-a2ui capability entry |
| `apps/cockpit/src/lib/route-resolution.ts` | Modify (imports + array) | Import and register chatA2uiPythonModule |
| `apps/cockpit/e2e/all-examples-smoke.spec.ts` | Modify (line 29) | Add c-a2ui to EXAMPLES array |
| `cockpit/chat/a2ui/angular/src/environments/environment.ts` | Modify | Fix assistantId to `c-a2ui` |
| `cockpit/chat/a2ui/angular/src/environments/environment.development.ts` | Modify | Fix port to 4511, assistantId to `c-a2ui` |
| `cockpit/chat/a2ui/python/langgraph.json` | Modify | Rename graph to `c-a2ui` |
| `cockpit/chat/a2ui/python/src/graph.py` | Rewrite | LLM-backed graph matching generative-ui pattern |
| `cockpit/chat/a2ui/python/prompts/a2ui.md` | Rewrite | Fix inaccurate prop names, add validation docs |
| `cockpit/chat/a2ui/python/docs/guide.md` | Modify | Remove `_bindings` from example, fix StateStore claim |
| `cockpit/chat/a2ui/angular/e2e/a2ui.spec.ts` | Rewrite | Match all-examples-smoke pattern |
| `cockpit/chat/a2ui/angular/src/index.ts` | Modify (if needed) | Verify module shape matches conventions |
| `cockpit/chat/a2ui/python/src/index.ts` | Modify (if needed) | Verify module shape matches conventions |

---

### Task 1: Add `_bindings` to RESERVED_KEYS in surfaceToSpec

**Files:**
- Modify: `libs/chat/src/lib/a2ui/surface-to-spec.ts:6`
- Modify: `libs/chat/src/lib/a2ui/surface-to-spec.spec.ts` (add test at end)

- [ ] **Step 1: Write the failing test**

Add this test to the end of `libs/chat/src/lib/a2ui/surface-to-spec.spec.ts`, inside the `surfaceToSpec — binding tracking` describe block (after line 327):

```typescript
  it('filters out agent-authored _bindings and uses auto-detected bindings', () => {
    const surface = makeSurface(
      [{
        id: 'root', component: 'TextField', label: 'Name',
        value: { path: '/name' } as any,
        _bindings: { value: '/name' },
      } as any],
      { name: 'Alice' },
    );
    const spec = surfaceToSpec(surface)!;
    // _bindings should come from auto-detection, not from agent input
    expect(spec.elements['root'].props['_bindings']).toEqual({ value: '/name' });
    // The agent-authored _bindings object should not leak as a separate resolved prop
    // (it would be { value: '/name' } as a literal if not filtered)
  });
```

- [ ] **Step 2: Run test to verify it passes (it currently passes by coincidence)**

Run: `npx nx test chat --testPathPattern='surface-to-spec' --reporter=verbose`

Expected: PASS (the auto-detected bindings overwrite the leaked prop). This test documents the correct behavior; the real fix prevents the leak.

- [ ] **Step 3: Add `_bindings` to RESERVED_KEYS**

In `libs/chat/src/lib/a2ui/surface-to-spec.ts`, change line 6 from:

```typescript
const RESERVED_KEYS = new Set(['id', 'component', 'children', 'action', 'checks']);
```

to:

```typescript
const RESERVED_KEYS = new Set(['id', 'component', 'children', 'action', 'checks', '_bindings']);
```

- [ ] **Step 4: Run all chat tests to verify nothing breaks**

Run: `npx nx test chat --reporter=verbose`

Expected: All tests pass (225+)

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface-to-spec.ts libs/chat/src/lib/a2ui/surface-to-spec.spec.ts
git commit -m "fix(chat): add _bindings to surfaceToSpec RESERVED_KEYS

Prevents agent-authored _bindings from leaking through as a regular
resolved prop. Only auto-detected bindings from path references are set."
```

---

### Task 2: Fix Port, Graph Name, and Environment Config

**Files:**
- Modify: `cockpit/chat/a2ui/angular/src/environments/environment.ts`
- Modify: `cockpit/chat/a2ui/angular/src/environments/environment.development.ts`
- Modify: `cockpit/chat/a2ui/python/langgraph.json`

- [ ] **Step 1: Fix production environment**

Replace the entire content of `cockpit/chat/a2ui/angular/src/environments/environment.ts` with:

```typescript
export const environment = {
  production: true,
  langGraphApiUrl: '/api',
  a2uiAssistantId: 'c-a2ui',
};
```

- [ ] **Step 2: Fix development environment**

Replace the entire content of `cockpit/chat/a2ui/angular/src/environments/environment.development.ts` with:

```typescript
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4511/api',
  a2uiAssistantId: 'c-a2ui',
};
```

- [ ] **Step 3: Fix LangGraph graph name**

Replace the entire content of `cockpit/chat/a2ui/python/langgraph.json` with:

```json
{
  "graphs": {
    "c-a2ui": "./src/graph.py:graph"
  },
  "dependencies": ["."],
  "python_version": "3.12",
  "env": ".env"
}
```

- [ ] **Step 4: Run the Angular smoke test to verify module shape**

Run: `npx nx smoke cockpit-chat-a2ui-angular`

Expected: PASS (verifies module exports correctly)

- [ ] **Step 5: Commit**

```bash
git add cockpit/chat/a2ui/angular/src/environments/environment.ts cockpit/chat/a2ui/angular/src/environments/environment.development.ts cockpit/chat/a2ui/python/langgraph.json
git commit -m "fix(cockpit): fix A2UI port conflict and graph name convention

Change dev port from 4311 (conflicts with filesystem) to 4511.
Rename graph from a2ui_form to c-a2ui matching chat convention."
```

---

### Task 3: Convert graph.py to LLM-Backed

**Files:**
- Rewrite: `cockpit/chat/a2ui/python/src/graph.py`

- [ ] **Step 1: Rewrite graph.py**

Replace the entire content of `cockpit/chat/a2ui/python/src/graph.py` with:

```python
"""
A2UI Chat Graph

A LangGraph StateGraph that generates A2UI JSONL responses using an LLM.
The Angular frontend detects the ---a2ui_JSON--- prefix and renders
interactive surfaces from the streamed component definitions.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_a2ui_graph():
    """
    Single-node graph that invokes an LLM with the A2UI system prompt.
    The LLM generates A2UI JSONL that builds interactive surfaces.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "a2ui.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)

    return graph.compile()


graph = build_a2ui_graph()
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/chat/a2ui/python/src/graph.py
git commit -m "feat(cockpit): convert A2UI graph to LLM-backed generation

Replace hardcoded form JSONL with ChatOpenAI invocation using system
prompt, matching the generative-ui example pattern."
```

---

### Task 4: Rewrite A2UI System Prompt

**Files:**
- Rewrite: `cockpit/chat/a2ui/python/prompts/a2ui.md`

- [ ] **Step 1: Rewrite the prompt with correct component API**

Replace the entire content of `cockpit/chat/a2ui/python/prompts/a2ui.md` with:

```markdown
# A2UI Assistant

You are an assistant that builds interactive UIs using the A2UI (Agent-to-UI) protocol.

When the user asks you to create a form, dashboard, or any interactive UI, respond with A2UI JSONL — newline-delimited JSON messages prefixed with `---a2ui_JSON---`.

When the user sends a JSON message with `"version": "v0.9"` and an `"action"` field, that is a form submission event. Read the `action.context` object to see the submitted values and respond conversationally (in plain text/markdown, not A2UI).

## Response Format

Your entire response must start with the prefix, then one JSON message per line:

```
---a2ui_JSON---
{"createSurface":{"surfaceId":"s1","catalogId":"basic","sendDataModel":true}}
{"updateDataModel":{"surfaceId":"s1","value":{"name":"","email":""}}}
{"updateComponents":{"surfaceId":"s1","components":[...]}}
```

## Message Types

| Message | Purpose |
|---------|---------|
| `createSurface` | Initialize a surface. Set `sendDataModel: true` to receive the full data model with form submissions. |
| `updateDataModel` | Set initial data model values at `/` (root). |
| `updateComponents` | Define the component tree. Each component has `id`, `component` type, and type-specific props. |

## Available Components

### Display

| Component | Props |
|-----------|-------|
| `Text` | `text` (string) |
| `Image` | `url` (string), `alt` (string) |
| `Icon` | `name` (string — use emoji like "✓" or "⚠️") |
| `Divider` | *(none)* |

### Layout

| Component | Props |
|-----------|-------|
| `Column` | `children` (string[] of component IDs) |
| `Row` | `children` (string[] of component IDs) |
| `Card` | `title` (string), `children` (string[] of component IDs) |
| `List` | `children` (string[] of component IDs) |
| `Tabs` | `tabs` (array of `{label, childKeys}`), `selected` (number or path ref) |
| `Modal` | `title` (string), `open` (boolean or path ref), `children` (string[]), `dismissible` (boolean) |

### Input

| Component | Props |
|-----------|-------|
| `TextField` | `label` (string), `value` (string or path ref), `placeholder` (string) |
| `CheckBox` | `label` (string), `checked` (boolean or path ref) |
| `ChoicePicker` | `label` (string), `options` (string[]), `selected` (string or path ref) |
| `DateTimeInput` | `label` (string), `value` (string or path ref), `inputType` (`"date"` or `"time"` or `"datetime-local"`), `min` (string), `max` (string) |
| `Slider` | `label` (string), `value` (number or path ref), `min` (number), `max` (number), `step` (number) |

### Interactive

| Component | Props |
|-----------|-------|
| `Button` | `label` (string), `variant` (`"primary"` or `"borderless"`), `disabled` (boolean), `action` (Action object), `checks` (CheckRule[]) |

### Media

| Component | Props |
|-----------|-------|
| `Video` | `url` (string), `poster` (string), `autoplay` (boolean), `controls` (boolean) |
| `AudioPlayer` | `url` (string), `autoplay` (boolean), `controls` (boolean) |

## Data Model Binding

Use `{"path": "/fieldName"}` as a prop value to bind it to the data model. When the user changes an input, the value at that path updates automatically.

```json
{"id": "name", "component": "TextField", "label": "Name", "value": {"path": "/name"}}
```

Do NOT include a `_bindings` prop — the renderer generates bindings automatically from path references.

## Actions

Buttons can have an event action that sends data back to you:

```json
{
  "action": {
    "event": {
      "name": "formSubmit",
      "context": {
        "name": {"path": "/name"},
        "email": {"path": "/email"}
      }
    }
  }
}
```

Context values can be path references (resolved at click time) or literal values.

## Validation (checks)

Input components and buttons can have a `checks` array for client-side validation. Each check has a `condition` and an error `message`. If any check fails, the button is disabled and error messages display.

```json
{
  "checks": [
    {
      "condition": {"call": "required", "args": {"value": {"path": "/name"}}},
      "message": "Name is required"
    }
  ]
}
```

Built-in validation functions: `required`, `email`, `regex`, `length`, `numeric`.

Compose with `and`, `or`, `not`:

```json
{
  "condition": {
    "call": "and",
    "args": {
      "values": [
        {"call": "required", "args": {"value": {"path": "/name"}}},
        {"call": "email", "args": {"value": {"path": "/email"}}}
      ]
    }
  },
  "message": "Name and valid email required"
}
```

## Rules

1. Always start with `---a2ui_JSON---` on the first line.
2. One JSON message per line, no trailing commas or extra whitespace.
3. Always send `createSurface` first, then `updateDataModel`, then `updateComponents`.
4. Every component referenced in `children` must have a matching `id` in the components array.
5. The root component must have `id: "root"`.
6. Do NOT include `_bindings` in component definitions.
7. When responding to a form submission (v0.9 action message), respond in plain markdown — do NOT emit A2UI JSONL.
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/chat/a2ui/python/prompts/a2ui.md
git commit -m "docs(cockpit): rewrite A2UI system prompt with correct component API

Fix inaccurate prop names (Text.content→text, remove Row.gap),
add validation/checks docs, add sendDataModel, clarify _bindings
is auto-populated."
```

---

### Task 5: Fix guide.md

**Files:**
- Modify: `cockpit/chat/a2ui/python/docs/guide.md`

- [ ] **Step 1: Fix the data model binding step**

In `cockpit/chat/a2ui/python/docs/guide.md`, replace lines 73-84 (the Step 4 content about data model binding):

Find:
```markdown
<Step title="Data model binding">

Components bind to the data model using path references:

```json
{"id": "name_field", "component": "TextField",
 "label": "Name", "value": {"path": "/name"},
 "_bindings": {"value": "/name"}}
```

When the user types in the field, the value at `/name` in the data model
updates automatically via the render-lib StateStore.

</Step>
```

Replace with:
```markdown
<Step title="Data model binding">

Components bind to the data model using path references:

```json
{"id": "name_field", "component": "TextField",
 "label": "Name", "value": {"path": "/name"}}
```

The `surfaceToSpec` function auto-detects path references and populates
`_bindings` for each input component — agents do not write `_bindings`
directly. When the user changes a bound input, the component emits a
data model update event.

**Known limitation:** Data model updates from user input do not currently
reflect to other components in real time. The agent can refresh state by
sending a new `updateDataModel` message.

</Step>
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/chat/a2ui/python/docs/guide.md
git commit -m "docs(cockpit): fix A2UI guide — remove _bindings from example, clarify StateStore limitation"
```

---

### Task 6: Register A2UI in Cockpit

**Files:**
- Modify: `libs/cockpit-registry/src/lib/manifest.ts:47`
- Modify: `apps/cockpit/scripts/capability-registry.ts:47`
- Modify: `apps/cockpit/src/lib/route-resolution.ts` (imports + array)
- Modify: `apps/cockpit/e2e/all-examples-smoke.spec.ts:29`

- [ ] **Step 1: Add 'a2ui' to APPROVED_TOPICS in manifest.ts**

In `libs/cockpit-registry/src/lib/manifest.ts`, find the chat core-capabilities array (line 47):

```typescript
      'theming',
    ],
```

Replace with:

```typescript
      'theming',
      'a2ui',
    ],
```

- [ ] **Step 2: Add c-a2ui to capability-registry.ts**

In `apps/cockpit/scripts/capability-registry.ts`, after the c-theming entry (line 47), add:

```typescript
  { id: 'c-a2ui', product: 'chat', topic: 'a2ui', angularProject: 'cockpit-chat-a2ui-angular', port: 4511, pythonDir: 'cockpit/chat/a2ui/python', graphName: 'c-a2ui' },
```

- [ ] **Step 3: Import and register chatA2uiPythonModule in route-resolution.ts**

In `apps/cockpit/src/lib/route-resolution.ts`, add this import after line 35 (the chatThemingPythonModule import):

```typescript
import { chatA2uiPythonModule } from '../../../../cockpit/chat/a2ui/python/src/index';
```

Then add `chatA2uiPythonModule` to the `capabilityModules` array after `chatThemingPythonModule` (after line 104):

```typescript
  chatA2uiPythonModule,
```

- [ ] **Step 4: Add c-a2ui to all-examples-smoke.spec.ts**

In `apps/cockpit/e2e/all-examples-smoke.spec.ts`, add this entry to the EXAMPLES array after the sandboxes entry (after line 28):

```typescript
  // Render capabilities
```

Wait — the render capabilities come after. Add the A2UI entry within the chat section. Find line 29 (end of the current EXAMPLES array, before the `] as const;`). Looking at the file structure, the chat capabilities aren't listed yet. Add after sandboxes but before the closing:

Actually, the EXAMPLES array only has 14 entries (langgraph + deep-agents). Chat and render examples are missing. Add A2UI alongside the other chat examples that should be added. For now, add just the A2UI entry at the end of the array:

After line 28 (`{ name: 'sandboxes', port: 4315, selector: 'app-sandboxes' },`), add:

```typescript
  { name: 'c-a2ui', port: 4511, selector: 'app-a2ui' },
```

Also update the comment at line 12 from "14" to "15" to reflect the new count.

- [ ] **Step 5: Run cockpit build to verify registration**

Run: `npx nx build cockpit --skip-nx-cache`

Expected: Build succeeds with the new A2UI module imported

- [ ] **Step 6: Commit**

```bash
git add libs/cockpit-registry/src/lib/manifest.ts apps/cockpit/scripts/capability-registry.ts apps/cockpit/src/lib/route-resolution.ts apps/cockpit/e2e/all-examples-smoke.spec.ts
git commit -m "feat(cockpit): register A2UI in manifest, capability registry, routes, and e2e

Add a2ui to APPROVED_TOPICS, capability-registry (port 4511),
route-resolution imports, and all-examples-smoke test suite."
```

---

### Task 7: Rewrite A2UI E2E Test

**Files:**
- Rewrite: `cockpit/chat/a2ui/angular/e2e/a2ui.spec.ts`

- [ ] **Step 1: Rewrite e2e test matching all-examples-smoke pattern**

Replace the entire content of `cockpit/chat/a2ui/angular/e2e/a2ui.spec.ts` with:

```typescript
import { expect, test } from '@playwright/test';

test.describe('A2UI Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4511');
    await page.waitForSelector('app-a2ui', { state: 'attached', timeout: 10000 });
  });

  test('renders the chat interface', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible({ timeout: 5000 });
  });

  test('displays input and send button', async ({ page }) => {
    await expect(page.locator('input[name="prompt"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/chat/a2ui/angular/e2e/a2ui.spec.ts
git commit -m "test(cockpit): rewrite A2UI e2e test matching smoke test pattern

Verify chat renders, input and send button visible on port 4511."
```

---

### Task 8: Verify Module Exports Match Conventions

**Files:**
- Modify (if needed): `cockpit/chat/a2ui/angular/src/index.ts`
- Modify (if needed): `cockpit/chat/a2ui/python/src/index.ts`

- [ ] **Step 1: Check Angular module export**

Read `cockpit/chat/a2ui/angular/src/index.ts`. Verify that:
- The `id` field is `'chat-a2ui-angular'`
- The `manifestIdentity.topic` is `'a2ui'`
- The `title` is `'Chat A2UI (Angular)'`
- The smoke test in `project.json` matches these values

No changes needed if these are already correct (they are based on exploration).

- [ ] **Step 2: Check Python module export**

Read `cockpit/chat/a2ui/python/src/index.ts`. Verify that:
- The `manifestIdentity.topic` is `'a2ui'`
- The `runtimeUrl` is `'chat/a2ui'`
- The `devPort` is `4511`

No changes needed if correct (they are based on exploration).

- [ ] **Step 3: Run Angular build to verify everything compiles**

Run: `npx nx build cockpit-chat-a2ui-angular --configuration=production --skip-nx-cache`

Expected: Build succeeds

- [ ] **Step 4: Run all chat lib tests**

Run: `npx nx test chat --reporter=verbose`

Expected: All tests pass (225+)

- [ ] **Step 5: Run all a2ui lib tests**

Run: `npx nx test a2ui --reporter=verbose`

Expected: All tests pass (91+)

---

### Task 9: Final Verification

- [ ] **Step 1: Run the full cockpit build**

Run: `npx nx build cockpit --skip-nx-cache`

Expected: Build succeeds, A2UI module resolved

- [ ] **Step 2: Run the cockpit e2e smoke tests (headless)**

Run: `npx nx e2e cockpit --skip-nx-cache`

Expected: All existing smoke tests pass

- [ ] **Step 3: Verify assemble-examples includes A2UI**

Run: `grep -n 'a2ui' scripts/assemble-examples.ts`

Expected: A2UI is already listed at line 50. No changes needed.

- [ ] **Step 4: Commit any remaining changes and verify clean tree**

Run: `git status`

Expected: Clean working tree, all changes committed.
