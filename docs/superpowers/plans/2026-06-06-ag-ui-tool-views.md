# AG-UI Tool Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chat-lib capability that renders a frontend component for a tool call by reusing the existing `views` registry, then ship the `ag-ui/tool-views` cockpit example that exercises it.

**Architecture:** When a tool call's `name` matches a key in the `views` registry, the chat composition bridges that call into a synthetic one-element render spec — `{ root: name, elements: { [name]: { type: name, props: { ...args, ...result, status } } } }` — and renders it through the existing `<chat-generative-ui>` → `RenderSpecComponent` pipeline. Matched tool names are auto-excluded from the default tool card. No new public input is added and no change is made to `RenderSpecComponent`/`RenderElementComponent`; json-render already treats non-expression prop values as literal passthrough and re-renders reactively as `args` accumulate and `result` arrives.

**Tech Stack:** Angular 20 (standalone, signals, `input()`/`computed()`), `@threadplane/chat`, `@threadplane/render` (`@json-render/core`), `@threadplane/ag-ui` adapter (AG-UI protocol), Python LangGraph + `ag-ui-langgraph` (FastAPI/uvicorn/SSE), Nx, Vitest, Playwright + aimock fixtures.

**Constraint (verbatim from the repo owner):** Make no reference or mention of CopilotKit or Hashbrown in code, docs, comments, or commits. Describe all patterns generically.

**Branch:** `claude/ag-ui-tool-based-genui` (already checked out). Spec: `docs/superpowers/specs/2026-06-06-ag-ui-tool-views-design.md`.

---

## File Structure

**Lib capability (`libs/chat`):**
- Create: `libs/chat/src/lib/primitives/chat-tool-calls/resolve-message-tool-calls.ts` — shared per-message tool-call resolution (extracted from `ChatToolCallsComponent`).
- Create: `libs/chat/src/lib/primitives/chat-tool-calls/resolve-message-tool-calls.spec.ts` — unit test for the util.
- Modify: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts` — call the shared util.
- Create: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.ts` — the new primitive (synthetic-spec bridge).
- Create: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.spec.ts` — lib behavior test.
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts` — mount `<chat-tool-views>`, compute `viewToolNames`, extend `excludeToolNames`.
- Modify: `libs/chat/src/public-api.ts` — export `ChatToolViewsComponent`.

**Example backend (`cockpit/ag-ui/tool-views/python`):** `pyproject.toml`, `requirements.txt`, `.gitignore`, `tsconfig.json`, `project.json`, `src/__init__.py`, `src/graph.py`, `src/server.py`, `src/index.ts`, `prompts/tool-views.md`, `docs/guide.md`.

**Example frontend (`cockpit/ag-ui/tool-views/angular`):** `package.json`, `project.json`, `vercel.json`, `proxy.conf.mjs`, `tsconfig.json`, `tsconfig.app.json`, `src/{index.html, index.ts, main.ts, main.cockpit.ts, styles.css}`, `src/environments/{environment.ts, environment.development.ts}`, `src/app/{app.config.ts, tool-views.component.ts, weather-card.component.ts}`, `prompts/tool-views.md`, plus `e2e/{playwright.config.ts, global-setup-impl.ts, tool-views.spec.ts, tsconfig.json, fixtures/tool-views.json, manual/tool-views.manual.ts}`.

**Registry wiring:**
- Modify: `cockpit/ports.mjs` — add port pair 4322/5322.
- Modify: `apps/cockpit/scripts/capability-registry.ts` — add `ag-ui-tool-views` entry.
- Modify: `apps/cockpit/src/lib/route-resolution.ts` — import + register `agUiToolViewsPythonModule`.
- Modify: `libs/cockpit-registry/src/lib/manifest.ts` — add `'tool-views'` to ag-ui core-capabilities.

---

## Task 1: Extract `resolveMessageToolCalls` shared util

The per-message tool-call resolution currently lives inside `ChatToolCallsComponent.toolCalls`. Extract it verbatim so `ChatToolViewsComponent` can reuse the exact same scoping logic. Behavior must stay identical.

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-tool-calls/resolve-message-tool-calls.ts`
- Create: `libs/chat/src/lib/primitives/chat-tool-calls/resolve-message-tool-calls.spec.ts`
- Modify: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts:114-137`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/primitives/chat-tool-calls/resolve-message-tool-calls.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { mockAgent } from '../../testing/mock-agent';
import type { Message, ToolCall } from '../../agent';
import { resolveMessageToolCalls } from './resolve-message-tool-calls';

describe('resolveMessageToolCalls', () => {
  const calls: ToolCall[] = [
    { id: 'a', name: 'get_weather', args: { city: 'NYC' }, status: 'complete', result: 'sunny' },
    { id: 'b', name: 'search', args: {}, status: 'running' },
  ];

  it('returns the global list when no message is provided', () => {
    const agent = mockAgent({ toolCalls: calls });
    expect(resolveMessageToolCalls(agent, undefined)).toHaveLength(2);
  });

  it('returns [] for a user message', () => {
    const agent = mockAgent({ toolCalls: calls });
    const msg: Message = { id: '1', role: 'user', content: 'hello' };
    expect(resolveMessageToolCalls(agent, msg)).toEqual([]);
  });

  it('scopes by toolCallIds on an assistant message', () => {
    const agent = mockAgent({ toolCalls: calls });
    const msg: Message = { id: '2', role: 'assistant', content: '', toolCallIds: ['b'] };
    const out = resolveMessageToolCalls(agent, msg);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
  });

  it('scopes by tool_use content blocks on an assistant message', () => {
    const agent = mockAgent({ toolCalls: calls });
    const msg: Message = {
      id: '3', role: 'assistant',
      content: [{ type: 'tool_use', id: 'a', name: 'get_weather', args: { city: 'NYC' } }],
    };
    const out = resolveMessageToolCalls(agent, msg);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test chat -- --run resolve-message-tool-calls`
Expected: FAIL — `Cannot find module './resolve-message-tool-calls'`.

- [ ] **Step 3: Write the util**

Create `libs/chat/src/lib/primitives/chat-tool-calls/resolve-message-tool-calls.ts`:

```ts
// SPDX-License-Identifier: MIT
import type { Agent, Message, ToolCall } from '../../agent';

/**
 * Resolves the tool calls that belong to a specific message, mirroring the
 * per-message scoping the chat lib uses to avoid every assistant bubble
 * re-rendering the whole thread's tool-call list.
 *
 * - No message context → the agent's global tool-call list.
 * - Assistant message with `toolCallIds` (LangGraph) → those ids, in order.
 * - Assistant message with `tool_use` content blocks (Anthropic) → those ids.
 * - Assistant message with no linkage → [] (this message emitted no calls).
 * - Any non-assistant message → the global list (callers filter as needed).
 *
 * MUST be called inside a reactive context (computed/effect) so the
 * `agent.toolCalls()` signal read registers a dependency.
 */
export function resolveMessageToolCalls(agent: Agent, message: Message | undefined): ToolCall[] {
  const all = agent.toolCalls();
  if (message && message.role === 'assistant') {
    if (message.toolCallIds && message.toolCallIds.length > 0) {
      return message.toolCallIds
        .map((id) => all.find((tc) => tc.id === id))
        .filter((x): x is ToolCall => !!x);
    }
    if (Array.isArray(message.content)) {
      const blocks = message.content.filter((b) => b.type === 'tool_use');
      return blocks
        .map((b) => all.find((tc) => tc.id === (b as { id: string }).id))
        .filter((x): x is ToolCall => !!x);
    }
    return [];
  }
  return all;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test chat -- --run resolve-message-tool-calls`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `ChatToolCallsComponent` to use the util**

In `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts`, add the import near the other imports (after line 11):

```ts
import { resolveMessageToolCalls } from './resolve-message-tool-calls';
```

Replace the entire `toolCalls` computed (lines 114–137) with:

```ts
  readonly toolCalls = computed((): ToolCall[] =>
    resolveMessageToolCalls(this.agent(), this.message()),
  );
```

- [ ] **Step 6: Run the existing tool-calls tests to verify no regression**

Run: `npx nx test chat -- --run chat-tool-calls`
Expected: PASS (all existing `ChatToolCallsComponent` tests still green).

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-tool-calls/resolve-message-tool-calls.ts \
        libs/chat/src/lib/primitives/chat-tool-calls/resolve-message-tool-calls.spec.ts \
        libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts
git commit -m "refactor(chat): extract resolveMessageToolCalls shared util"
```

---

## Task 2: `ChatToolViewsComponent` primitive (synthetic-spec bridge)

A new primitive that resolves a message's tool calls, keeps the ones whose `name` is a key in the `views` registry, and renders each as a synthetic one-element spec through `<chat-generative-ui>`.

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { views } from '@threadplane/render';
import { mockAgent, type MockAgent } from '../../testing/mock-agent';
import type { Message, ToolCall } from '../../agent';
import { ChatToolViewsComponent } from './chat-tool-views.component';

// A minimal view component that renders the props it receives so the test
// can assert which fields reached it.
@Component({
  selector: 'test-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="loc">{{ location() }}</div><div class="temp">{{ temperatureF() }}</div><div class="st">{{ status() }}</div>`,
})
class TestWeatherCardComponent {
  readonly location = input<string | undefined>(undefined);
  readonly temperatureF = input<number | undefined>(undefined);
  readonly status = input<string | undefined>(undefined);
}

function mountHost(agent: MockAgent, message: Message | undefined) {
  @Component({
    standalone: true,
    imports: [ChatToolViewsComponent],
    template: `<chat-tool-views [agent]="agent" [message]="message" [views]="reg" />`,
  })
  class HostComponent {
    readonly agent = agent;
    readonly message = message;
    readonly reg = views({ weather_card: TestWeatherCardComponent });
  }
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ChatToolViewsComponent', () => {
  let agent: MockAgent;
  const msg: Message = { id: 'm1', role: 'assistant', content: '', toolCallIds: ['c1'] };

  beforeEach(() => {
    agent = mockAgent();
  });

  it('mounts the registered view for a matching tool name and passes running args + status', () => {
    agent.toolCalls.set([
      { id: 'c1', name: 'weather_card', args: { location: 'San Francisco' }, status: 'running' },
    ] as ToolCall[]);
    const fixture = mountHost(agent, msg);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('test-weather-card')).toBeTruthy();
    expect(el.querySelector('.loc')?.textContent).toContain('San Francisco');
    expect(el.querySelector('.st')?.textContent).toContain('running');
  });

  it('merges result fields on completion', () => {
    agent.toolCalls.set([
      {
        id: 'c1', name: 'weather_card',
        args: { location: 'San Francisco' },
        status: 'complete',
        result: { location: 'San Francisco', temperatureF: 68, conditions: 'Sunny' },
      },
    ] as ToolCall[]);
    const fixture = mountHost(agent, msg);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.temp')?.textContent).toContain('68');
    expect(el.querySelector('.st')?.textContent).toContain('complete');
  });

  it('renders nothing for an unregistered tool name', () => {
    agent.toolCalls.set([
      { id: 'c1', name: 'lookup_flight', args: { flight: 'UA1' }, status: 'complete', result: {} },
    ] as ToolCall[]);
    const fixture = mountHost(agent, msg);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('test-weather-card')).toBeNull();
  });

  it('renders nothing when views is undefined', () => {
    agent.toolCalls.set([
      { id: 'c1', name: 'weather_card', args: {}, status: 'running' },
    ] as ToolCall[]);

    @Component({
      standalone: true,
      imports: [ChatToolViewsComponent],
      template: `<chat-tool-views [agent]="agent" [message]="message" />`,
    })
    class BareHost {
      readonly agent = agent;
      readonly message = msg;
    }
    const fixture = TestBed.createComponent(BareHost);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('test-weather-card')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test chat -- --run chat-tool-views`
Expected: FAIL — `Cannot find module './chat-tool-views.component'`.

- [ ] **Step 3: Write the component**

Create `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.ts`:

```ts
// libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Spec, StateStore } from '@json-render/core';
import type { ViewRegistry } from '@threadplane/render';
import { toRenderRegistry } from '@threadplane/render';
import type { Agent, Message, ToolCall } from '../../agent';
import { resolveMessageToolCalls } from '../chat-tool-calls/resolve-message-tool-calls';
import { ChatGenerativeUiComponent } from '../chat-generative-ui/chat-generative-ui.component';

/**
 * Renders a frontend component for a tool call by reusing the chat
 * composition's `views` registry. A tool call whose `name` matches a
 * registry key is bridged into a synthetic one-element render spec
 * (`{ root: name, elements: { [name]: { type: name, props } } }`) and
 * rendered through the existing render-spec pipeline.
 *
 * Props merge the live `args` (present while the call streams) with the
 * `result` (on completion) and always include `status`, so a view
 * component can show its own loading/empty/error states. `RenderElement`
 * filters props down to the component's declared inputs, so extra keys
 * (and a `status` a component chooses not to declare) are harmless.
 */
@Component({
  selector: 'chat-tool-views',
  standalone: true,
  imports: [ChatGenerativeUiComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (view of toolViews(); track view.id) {
      <chat-generative-ui
        [spec]="view.spec"
        [registry]="registry()"
        [store]="store()"
        [handlers]="handlers()"
        [loading]="view.loading"
      />
    }
  `,
})
export class ChatToolViewsComponent {
  readonly agent = input.required<Agent>();
  readonly message = input<Message | undefined>(undefined);
  readonly views = input<ViewRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});

  readonly registry = computed(() => {
    const v = this.views();
    return v ? toRenderRegistry(v) : undefined;
  });

  readonly toolViews = computed(() => {
    const v = this.views();
    if (!v) return [];
    const names = new Set(Object.keys(v));
    return resolveMessageToolCalls(this.agent(), this.message())
      .filter((tc) => names.has(tc.name))
      .map((tc) => ({ id: tc.id, loading: tc.status === 'running', spec: toToolViewSpec(tc) }));
  });
}

/** Wraps a tool call into a synthetic single-element render spec. */
function toToolViewSpec(tc: ToolCall): Spec {
  const args = isRecord(tc.args) ? tc.args : {};
  const result = isRecord(tc.result) ? tc.result : {};
  return {
    root: tc.name,
    elements: {
      [tc.name]: {
        type: tc.name,
        props: { ...args, ...result, status: tc.status },
      },
    },
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test chat -- --run chat-tool-views`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-tool-views/
git commit -m "feat(chat): add ChatToolViewsComponent tool-views bridge"
```

---

## Task 3: Wire `ChatToolViewsComponent` into `ChatComponent` + export

Mount the primitive in the per-message assistant template, exclude matched tool names from the default tool card, and export the component.

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts` (imports, template ~line 205, class ~line 360)
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Import the primitive in the chat composition**

In `libs/chat/src/lib/compositions/chat/chat.component.ts`, add next to the `ChatGenerativeUiComponent` import (line 23):

```ts
import { ChatToolViewsComponent } from '../../primitives/chat-tool-views/chat-tool-views.component';
```

Then add `ChatToolViewsComponent` to the component's `imports` array (find the `imports: [` list in the `@Component` decorator and append it).

- [ ] **Step 2: Add the `viewToolNames` computed**

In the `ChatComponent` class, immediately after the `renderRegistry` computed (ends at line 360), add:

```ts
  /** Tool names that have a registered view (keys of the `views` registry).
   *  These render as inline tool-views and are excluded from the default
   *  tool-call card so they don't render twice. */
  readonly viewToolNames = computed<readonly string[]>(() => Object.keys(this.views() ?? {}));
```

- [ ] **Step 3: Extend the default tool-card exclusion**

In the template, change the `<chat-tool-calls>` opening tag (line 205) from:

```html
                  <chat-tool-calls [agent]="agent()" [message]="message" [excludeToolNames]="genuiToolNames()">
```

to:

```html
                  <chat-tool-calls [agent]="agent()" [message]="message" [excludeToolNames]="excludedToolNames()">
```

Then add a combined computed after `viewToolNames` in the class:

```ts
  /** Union of GenUI dispatcher tool names and registered view tool names. */
  readonly excludedToolNames = computed<readonly string[]>(() => [
    ...this.genuiToolNames(),
    ...this.viewToolNames(),
  ]);
```

- [ ] **Step 4: Mount `<chat-tool-views>` in the assistant template**

Immediately after the closing `</chat-tool-calls>` tag (line 209), add:

```html
                  <chat-tool-views
                    [agent]="agent()"
                    [message]="message"
                    [views]="views()"
                    [store]="resolvedStore()"
                    [handlers]="handlers()"
                  />
```

- [ ] **Step 5: Export the primitive from the public API**

In `libs/chat/src/public-api.ts`, add after the `ChatToolCallsComponent` export (line 64):

```ts
export { ChatToolViewsComponent } from './lib/primitives/chat-tool-views/chat-tool-views.component';
```

- [ ] **Step 6: Run the chat lib test + build to verify**

Run: `npx nx test chat -- --run`
Expected: PASS (all chat lib tests, including the new ones).

Run: `npx nx build chat`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts libs/chat/src/public-api.ts
git commit -m "feat(chat): render tool-views in chat composition via views registry"
```

---

## Task 4: Example backend — `cockpit/ag-ui/tool-views/python`

A LangGraph graph whose agent calls a `weather_card` tool returning plain JSON, looped through a `ToolNode` so the tool call + result flow over the wire as AG-UI `TOOL_CALL_*` events. The tool name matches the registered view key.

**Files (all Create):**
- `cockpit/ag-ui/tool-views/python/pyproject.toml`
- `cockpit/ag-ui/tool-views/python/requirements.txt`
- `cockpit/ag-ui/tool-views/python/.gitignore`
- `cockpit/ag-ui/tool-views/python/tsconfig.json`
- `cockpit/ag-ui/tool-views/python/project.json`
- `cockpit/ag-ui/tool-views/python/src/__init__.py`
- `cockpit/ag-ui/tool-views/python/src/graph.py`
- `cockpit/ag-ui/tool-views/python/src/server.py`
- `cockpit/ag-ui/tool-views/python/src/index.ts`
- `cockpit/ag-ui/tool-views/python/prompts/tool-views.md`
- `cockpit/ag-ui/tool-views/python/docs/guide.md`

- [ ] **Step 1: Create the Python package scaffolding**

`cockpit/ag-ui/tool-views/python/.gitignore`:

```
__pycache__/
.venv/
```

`cockpit/ag-ui/tool-views/python/src/__init__.py`:

```
# SPDX-License-Identifier: MIT
```

`cockpit/ag-ui/tool-views/python/pyproject.toml`:

```toml
[project]
name = "cockpit-ag-ui-tool-views"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "langgraph>=0.3",
    "langchain-openai>=0.3",
    "langsmith>=0.2",
    "ag-ui-langgraph>=0.0.25",
    "fastapi>=0.110",
    "uvicorn[standard]>=0.29",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src"]
```

`cockpit/ag-ui/tool-views/python/tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../../../../",
    "jsx": "react-jsx",
    "outDir": "../../../../dist/out-tsc",
    "declaration": true,
    "emitDeclarationOnly": false,
    "paths": {
      "@threadplane/cockpit-registry": ["libs/cockpit-registry/src/index.ts"]
    },
    "types": ["node", "react"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 2: Write the prompt**

`cockpit/ag-ui/tool-views/python/prompts/tool-views.md`:

```markdown
# Tool Views Assistant

You are a helpful assistant demonstrating tool-driven view rendering with the
AG-UI adapter and LangGraph.

When the user asks about the weather for a location, call the `weather_card`
tool with that location. Do not describe the weather in prose first — call the
tool. The frontend owns a component registered under the name `weather_card`
that renders the tool call live from its arguments and result.

After the tool returns, give a one-sentence natural-language confirmation
(e.g. "Here's the current weather for San Francisco."). Keep it brief; the
card carries the detail.
```

- [ ] **Step 3: Write the graph (ToolNode loop)**

`cockpit/ag-ui/tool-views/python/src/graph.py`:

```python
"""
LangGraph Tool-Views Graph

Demonstrates tool-driven view rendering over AG-UI. The agent calls a
`weather_card` tool that returns plain JSON data — no UI spec. The tool call
and its result travel over the wire as AG-UI TOOL_CALL_* events; the Angular
frontend owns a component registered under the matching name and renders it
live from the call's args/result/status.

Flow: START -> agent <-> tools -> agent (loop) -> END
"""

from pathlib import Path

from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


@tool
async def weather_card(location: str) -> dict:
    """Look up the current weather for a location.

    Returns plain JSON data. The frontend renders a component registered
    under the name `weather_card` from this call's args and result.

    Args:
        location: The city or place to look up weather for.

    Returns:
        A dict with location, temperatureF, conditions, humidity, windMph.
    """
    # Deterministic demo data so e2e fixtures stay stable.
    return {
        "location": location,
        "temperatureF": 68,
        "conditions": "Sunny",
        "humidity": 55,
        "windMph": 8,
    }


_TOOLS = [weather_card]


def build_tool_views_graph():
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True).bind_tools(_TOOLS)

    async def agent(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "tool-views.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def route(state: MessagesState) -> str:
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else END

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent)
    graph.add_node("tools", ToolNode(_TOOLS))
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", route, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile(checkpointer=MemorySaver())


# The graph instance — referenced by server.py
graph = build_tool_views_graph()
```

- [ ] **Step 4: Write the server**

`cockpit/ag-ui/tool-views/python/src/server.py`:

```python
# SPDX-License-Identifier: MIT
from fastapi import FastAPI
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from .graph import graph

agent = LangGraphAgent(name="tool-views", graph=graph)
app = FastAPI(title="cockpit-ag-ui-tool-views")
add_langgraph_fastapi_endpoint(app, agent, path="/agent")


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
```

- [ ] **Step 5: Write the capability module (index.ts)**

`cockpit/ag-ui/tool-views/python/src/index.ts`:

```ts
export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'ag-ui';
    section: 'core-capabilities';
    topic: 'tool-views';
    page: 'overview';
    language: 'python';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
  backendAssetPaths: string[];
  docsAssetPaths: string[];
  runtimeUrl?: string;
  devPort?: number;
}

export const agUiToolViewsPythonModule: CockpitCapabilityModule = {
  id: 'ag-ui-tool-views-python',
  manifestIdentity: {
    product: 'ag-ui',
    section: 'core-capabilities',
    topic: 'tool-views',
    page: 'overview',
    language: 'python',
  },
  title: 'AG-UI Tool Views (Python)',
  docsPath: '/docs/ag-ui/core-capabilities/tool-views/overview/python',
  promptAssetPaths: ['cockpit/ag-ui/tool-views/python/prompts/tool-views.md'],
  codeAssetPaths: [
    'cockpit/ag-ui/tool-views/angular/src/app/tool-views.component.ts',
    'cockpit/ag-ui/tool-views/angular/src/app/weather-card.component.ts',
    'cockpit/ag-ui/tool-views/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/ag-ui/tool-views/python/src/graph.py',
    'cockpit/ag-ui/tool-views/python/src/server.py',
  ],
  docsAssetPaths: ['cockpit/ag-ui/tool-views/python/docs/guide.md'],
  runtimeUrl: 'ag-ui/tool-views',
  devPort: 4322,
};
```

- [ ] **Step 6: Write the Nx project.json (build + serve + smoke)**

`cockpit/ag-ui/tool-views/python/project.json`:

```json
{
  "name": "cockpit-ag-ui-tool-views-python",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/ag-ui/tool-views/python/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": [
        "{workspaceRoot}/dist/cockpit/ag-ui/tool-views/python"
      ],
      "options": {
        "outputPath": "dist/cockpit/ag-ui/tool-views/python",
        "main": "cockpit/ag-ui/tool-views/python/src/index.ts",
        "tsConfig": "cockpit/ag-ui/tool-views/python/tsconfig.json"
      }
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "cockpit/ag-ui/tool-views/python",
        "command": "npx tsx -e \"import { agUiToolViewsPythonModule } from './src/index.ts'; const module = agUiToolViewsPythonModule; if (module.id !== 'ag-ui-tool-views-python' || module.title !== 'AG-UI Tool Views (Python)') { throw new Error('Unexpected module shape for ' + module.id); }\""
      }
    },
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "cockpit/ag-ui/tool-views/python",
        "command": "uv run uvicorn src.server:app --port 5322"
      }
    }
  },
  "tags": [
    "scope:cockpit-e2e",
    "scope:cockpit-examples",
    "scope:cockpit-smoke"
  ]
}
```

- [ ] **Step 7: Generate `requirements.txt` from the lockfile**

Run:

```bash
cd cockpit/ag-ui/tool-views/python && uv lock && uv export --no-hashes -o requirements.txt && cd -
```

Expected: a `uv.lock` and a `requirements.txt` are produced (mirroring the streaming example's set of pins). If `uv` is unavailable in the execution environment, copy `cockpit/ag-ui/streaming/python/requirements.txt` to this path and change the editable-install project name comment header accordingly — the smoke target does not depend on it, but CI's pre-sync does.

- [ ] **Step 8: Write the docs guide**

`cockpit/ag-ui/tool-views/python/docs/guide.md`:

```markdown
# Tool-Driven View Rendering with AG-UI and Angular

<Summary>
Render a frontend component for a tool call by reusing the `views` registry
from `@threadplane/chat`. The agent calls a tool by name and returns plain
data; the frontend owns a component keyed by that name and renders it live
from the call's arguments, result, and status — no UI spec crosses the wire.
</Summary>

<Prompt>
Render a custom component for a tool call using `@threadplane/chat`. Register the component in the `views` map keyed by the tool's name, pass `views` to the `<chat>` component, and call the matching tool by name from your LangGraph agent. The chat composition bridges the tool call into the render pipeline automatically.
</Prompt>

<Steps>
<Step title="Register a view keyed by the tool name">

Build a `views` registry whose key matches the tool the agent calls:

```typescript
// tool-views.component.ts
import { views } from '@threadplane/chat';
import { WeatherCardComponent } from './weather-card.component';

readonly views = views({ weather_card: WeatherCardComponent });
```

The key (`weather_card`) is both the registry key and the tool name the
agent calls — one identifier, one mental model.

</Step>
<Step title="Pass the registry to the chat component">

```html
<chat main [agent]="agent" [views]="views" />
```

When a tool call's name matches a `views` key, the chat composition renders
the registered component inline in the transcript instead of the default
tool card.

</Step>
<Step title="Author the view component">

The component declares an input per field it renders. It receives the live
arguments while the call streams and the merged result on completion, plus a
`status` of `'running'` or `'complete'`:

```typescript
// weather-card.component.ts (excerpt)
readonly location = input<string>();
readonly temperatureF = input<number>();
readonly status = input<'running' | 'complete'>();
```

</Step>
<Step title="Call the tool by name from the agent">

The LangGraph agent binds a tool whose name matches the registered view and
returns plain JSON. The tool call and result travel over AG-UI's
`TOOL_CALL_*` events:

```python
# graph.py
@tool
async def weather_card(location: str) -> dict:
    return {"location": location, "temperatureF": 68, "conditions": "Sunny",
            "humidity": 55, "windMph": 8}
```

Run the backend with:

```bash
uv run uvicorn src.server:app --port 5322
```

<Warning>
A checkpointer is required for `ag-ui-langgraph` to call `graph.aget_state()`.
The graph in `src/graph.py` uses `MemorySaver` for development.
</Warning>

</Step>
</Steps>

<Tip>
The same `views` registry powers backend-sent render specs too — a component
you register here is reusable across tool-driven rendering and spec rendering.
</Tip>

<Related>
- [AG-UI Streaming](/ag-ui/core-capabilities/streaming/overview/python) — Real-time token streaming with the AG-UI adapter
- [AG-UI Interrupts](/ag-ui/core-capabilities/interrupts/overview/python) — Human-in-the-loop approval using the AG-UI adapter
</Related>
```

- [ ] **Step 9: Verify the smoke target**

Run: `npx nx smoke cockpit-ag-ui-tool-views-python`
Expected: PASS (module-shape check succeeds).

- [ ] **Step 10: Commit**

```bash
git add cockpit/ag-ui/tool-views/python/
git commit -m "feat(cockpit): ag-ui tool-views python backend (weather_card tool)"
```

---

## Task 5: Example frontend — `cockpit/ag-ui/tool-views/angular`

Mirror the streaming Angular app, adding `WeatherCardComponent` and wiring the `views` registry.

**Files (all Create):** see File Structure. The files below that are byte-for-byte analogues of the streaming app (only the topic slug `streaming`→`tool-views`, ports `4321/5321`→`4322/5322`, project name, and titles change) should be copied from `cockpit/ag-ui/streaming/angular/` and edited. The unique files (`tool-views.component.ts`, `weather-card.component.ts`, `app.config.ts`, `index.ts`) are given in full.

- [ ] **Step 1: Copy the boilerplate Angular files from the streaming example**

Run:

```bash
mkdir -p cockpit/ag-ui/tool-views/angular/src/app \
         cockpit/ag-ui/tool-views/angular/src/environments \
         cockpit/ag-ui/tool-views/angular/prompts
cp cockpit/ag-ui/streaming/angular/src/index.html        cockpit/ag-ui/tool-views/angular/src/index.html
cp cockpit/ag-ui/streaming/angular/src/main.ts           cockpit/ag-ui/tool-views/angular/src/main.ts
cp cockpit/ag-ui/streaming/angular/src/main.cockpit.ts   cockpit/ag-ui/tool-views/angular/src/main.cockpit.ts
cp cockpit/ag-ui/streaming/angular/src/styles.css        cockpit/ag-ui/tool-views/angular/src/styles.css
cp cockpit/ag-ui/streaming/angular/src/environments/environment.ts             cockpit/ag-ui/tool-views/angular/src/environments/environment.ts
cp cockpit/ag-ui/streaming/angular/src/environments/environment.development.ts cockpit/ag-ui/tool-views/angular/src/environments/environment.development.ts
cp cockpit/ag-ui/streaming/angular/tsconfig.json     cockpit/ag-ui/tool-views/angular/tsconfig.json
cp cockpit/ag-ui/streaming/angular/tsconfig.app.json cockpit/ag-ui/tool-views/angular/tsconfig.app.json
cp cockpit/ag-ui/streaming/angular/prompts/streaming.md cockpit/ag-ui/tool-views/angular/prompts/tool-views.md
```

Then verify `main.ts` / `main.cockpit.ts` reference the component by bootstrap — open both and confirm they bootstrap `AppComponent`/the root via `app.config`. If `main.ts` imports a component selector specific to streaming, it will be updated in Step 4 when the root component is defined. (The streaming `main.ts` bootstraps using `appConfig` + a root standalone component; mirror exactly.)

- [ ] **Step 2: Write `package.json`**

`cockpit/ag-ui/tool-views/angular/package.json`:

```json
{
  "name": "@threadplane/cockpit-ag-ui-tool-views-angular",
  "private": true,
  "version": "0.0.1",
  "peerDependencies": {
    "@threadplane/ag-ui": "*",
    "@threadplane/chat": "*"
  },
  "license": "MIT",
  "sideEffects": false
}
```

- [ ] **Step 3: Write `proxy.conf.mjs`, `vercel.json`, `project.json`**

`cockpit/ag-ui/tool-views/angular/proxy.conf.mjs`:

```js
// SPDX-License-Identifier: MIT
import { portsFor } from '../../../../cockpit/ports.mjs';
const { langgraph: backend } = portsFor('cockpit-ag-ui-tool-views-angular');
export default {
  '/agent': { target: `http://localhost:${backend}`, secure: false, changeOrigin: true, ws: true },
};
```

`cockpit/ag-ui/tool-views/angular/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npx nx build cockpit-ag-ui-tool-views-angular",
  "outputDirectory": "dist/cockpit/ag-ui/tool-views/angular/browser",
  "framework": null
}
```

`cockpit/ag-ui/tool-views/angular/project.json` (mirror of streaming with the slug/name/port swapped):

```json
{
  "name": "cockpit-ag-ui-tool-views-angular",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/ag-ui/tool-views/angular/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "outputs": ["{options.outputPath.base}"],
      "options": {
        "outputPath": {
          "base": "dist/cockpit/ag-ui/tool-views/angular",
          "browser": ""
        },
        "browser": "cockpit/ag-ui/tool-views/angular/src/main.ts",
        "tsConfig": "cockpit/ag-ui/tool-views/angular/tsconfig.app.json",
        "styles": ["cockpit/ag-ui/tool-views/angular/src/styles.css"]
      },
      "configurations": {
        "production": {
          "budgets": [
            { "type": "initial", "maximumWarning": "1mb", "maximumError": "1.5mb" },
            { "type": "anyComponentStyle", "maximumWarning": "10kb", "maximumError": "16kb" }
          ],
          "outputHashing": "none"
        },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true,
          "fileReplacements": [
            {
              "replace": "cockpit/ag-ui/tool-views/angular/src/environments/environment.ts",
              "with": "cockpit/ag-ui/tool-views/angular/src/environments/environment.development.ts"
            }
          ]
        },
        "cockpit": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true,
          "fileReplacements": [
            {
              "replace": "cockpit/ag-ui/tool-views/angular/src/environments/environment.ts",
              "with": "cockpit/ag-ui/tool-views/angular/src/environments/environment.development.ts"
            }
          ],
          "browser": "cockpit/ag-ui/tool-views/angular/src/main.cockpit.ts"
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "continuous": true,
      "executor": "@angular/build:dev-server",
      "configurations": {
        "production": { "buildTarget": "cockpit-ag-ui-tool-views-angular:build:production" },
        "development": { "buildTarget": "cockpit-ag-ui-tool-views-angular:build:development" },
        "cockpit": { "buildTarget": "cockpit-ag-ui-tool-views-angular:build:cockpit" }
      },
      "defaultConfiguration": "development",
      "options": {
        "proxyConfig": "cockpit/ag-ui/tool-views/angular/proxy.conf.mjs"
      }
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "cockpit/ag-ui/tool-views/angular",
        "command": "npx tsx -e \"import { agUiToolViewsAngularModule } from './src/index.ts'; const module = agUiToolViewsAngularModule; if (module.id !== 'ag-ui-tool-views-angular' || module.title !== 'AG-UI Tool Views (Angular)') { throw new Error('Unexpected module shape for ' + module.id); }\""
      }
    },
    "e2e": {
      "executor": "@nx/playwright:playwright",
      "options": {
        "config": "cockpit/ag-ui/tool-views/angular/e2e/playwright.config.ts"
      }
    }
  },
  "tags": ["scope:cockpit-e2e", "scope:cockpit-examples"]
}
```

- [ ] **Step 4: Write the Angular `index.ts` capability module**

`cockpit/ag-ui/tool-views/angular/src/index.ts`:

```ts
export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'ag-ui';
    section: 'core-capabilities';
    topic: 'tool-views';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
  backendAssetPaths: string[];
}

export const agUiToolViewsAngularModule: CockpitCapabilityModule = {
  id: 'ag-ui-tool-views-angular',
  manifestIdentity: {
    product: 'ag-ui',
    section: 'core-capabilities',
    topic: 'tool-views',
    page: 'overview',
    language: 'angular',
  },
  title: 'AG-UI Tool Views (Angular)',
  docsPath: '/docs/ag-ui/core-capabilities/tool-views/overview/angular',
  promptAssetPaths: ['cockpit/ag-ui/tool-views/angular/prompts/tool-views.md'],
  codeAssetPaths: [
    'cockpit/ag-ui/tool-views/angular/src/app/tool-views.component.ts',
    'cockpit/ag-ui/tool-views/angular/src/app/weather-card.component.ts',
    'cockpit/ag-ui/tool-views/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/ag-ui/tool-views/python/src/graph.py',
    'cockpit/ag-ui/tool-views/python/src/server.py',
  ],
};
```

- [ ] **Step 5: Write `app.config.ts`**

`cockpit/ag-ui/tool-views/angular/src/app/app.config.ts`:

```ts
// SPDX-License-Identifier: MIT
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/ag-ui';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ url: '/agent' }),
    provideChat({}),
  ],
};
```

- [ ] **Step 6: Write `weather-card.component.ts`**

`cockpit/ag-ui/tool-views/angular/src/app/weather-card.component.ts`:

```ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A frontend-owned view rendered for the `weather_card` tool call. Receives
 * the tool call's arguments while it streams (`location`), the merged result
 * on completion (`temperatureF`, `conditions`, `humidity`, `windMph`), and a
 * `status` of 'running' | 'complete'. Renders a loading affordance until the
 * result arrives.
 */
@Component({
  selector: 'app-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wc">
      <div class="wc__head">
        <span class="wc__loc">{{ location() ?? 'Weather' }}</span>
        @if (pending()) { <span class="wc__badge">Loading…</span> }
      </div>
      @if (!pending()) {
        <div class="wc__temp">{{ temperatureF() }}°F</div>
        <div class="wc__cond">{{ conditions() }}</div>
        <dl class="wc__meta">
          <div><dt>Humidity</dt><dd>{{ humidity() }}%</dd></div>
          <div><dt>Wind</dt><dd>{{ windMph() }} mph</dd></div>
        </dl>
      }
    </div>
  `,
  styles: [`
    .wc { border: 1px solid var(--ngaf-chat-separator, #e5e7eb); border-radius: 12px; padding: 16px; max-width: 320px; }
    .wc__head { display: flex; align-items: center; justify-content: space-between; }
    .wc__loc { font-weight: 600; }
    .wc__badge { font-size: 12px; opacity: 0.7; }
    .wc__temp { font-size: 32px; font-weight: 700; margin-top: 8px; }
    .wc__cond { opacity: 0.8; }
    .wc__meta { display: flex; gap: 24px; margin: 12px 0 0; }
    .wc__meta dt { font-size: 11px; text-transform: uppercase; opacity: 0.6; }
    .wc__meta dd { margin: 0; font-weight: 600; }
  `],
})
export class WeatherCardComponent {
  readonly location = input<string>();
  readonly temperatureF = input<number>();
  readonly conditions = input<string>();
  readonly humidity = input<number>();
  readonly windMph = input<number>();
  readonly status = input<'running' | 'complete'>();

  readonly pending = computed(() => this.status() !== 'complete' || this.temperatureF() === undefined);
}
```

- [ ] **Step 7: Write the root component `tool-views.component.ts`**

`cockpit/ag-ui/tool-views/angular/src/app/tool-views.component.ts`:

```ts
// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, views } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { WeatherCardComponent } from './weather-card.component';

/**
 * Tool-views demo — renders a frontend component for a tool call by reusing
 * the chat composition's `views` registry. The agent calls a tool named
 * `weather_card`; the component registered under that key renders inline in
 * the transcript, live from the call's args/result/status. No UI spec is
 * sent from the backend.
 */
@Component({
  selector: 'app-tool-views',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" [views]="views" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class ToolViewsComponent {
  protected readonly agent = injectAgent();
  protected readonly views = views({ weather_card: WeatherCardComponent });
}
```

- [ ] **Step 8: Point `main.ts` / `main.cockpit.ts` at the root component**

Open `cockpit/ag-ui/tool-views/angular/src/main.ts` and `main.cockpit.ts`. They were copied from streaming, which bootstraps `StreamingComponent`. Change the import and bootstrap target to `ToolViewsComponent`:

```ts
// main.ts (and main.cockpit.ts) — adjust import + bootstrap call
import { ToolViewsComponent } from './app/tool-views.component';
import { appConfig } from './app/app.config';
import { bootstrapApplication } from '@angular/platform-browser';

bootstrapApplication(ToolViewsComponent, appConfig).catch((err) => console.error(err));
```

(Match whatever extra providers `main.cockpit.ts` adds for the cockpit iframe shell — copy that block verbatim from the streaming `main.cockpit.ts`, only swapping the bootstrapped component to `ToolViewsComponent`.)

- [ ] **Step 9: Build the Angular app to verify**

Run: `npx nx build cockpit-ag-ui-tool-views-angular`
Expected: build succeeds; bundle under the initial-size budget.

Run: `npx nx smoke cockpit-ag-ui-tool-views-angular`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add cockpit/ag-ui/tool-views/angular/
git commit -m "feat(cockpit): ag-ui tool-views angular app (weather card view)"
```

---

## Task 6: Example e2e — fixture + spec

Mirror the streaming e2e harness, with a two-stage aimock fixture: the first turn returns a `weather_card` tool call; once the tool result is present, the LLM returns a confirming sentence.

**Files (all Create):**
- `cockpit/ag-ui/tool-views/angular/e2e/playwright.config.ts`
- `cockpit/ag-ui/tool-views/angular/e2e/global-setup-impl.ts`
- `cockpit/ag-ui/tool-views/angular/e2e/tsconfig.json`
- `cockpit/ag-ui/tool-views/angular/e2e/fixtures/tool-views.json`
- `cockpit/ag-ui/tool-views/angular/e2e/tool-views.spec.ts`
- `cockpit/ag-ui/tool-views/angular/e2e/manual/tool-views.manual.ts`

- [ ] **Step 1: Copy + edit the e2e config files**

Run:

```bash
mkdir -p cockpit/ag-ui/tool-views/angular/e2e/fixtures cockpit/ag-ui/tool-views/angular/e2e/manual
cp cockpit/ag-ui/streaming/angular/e2e/tsconfig.json cockpit/ag-ui/tool-views/angular/e2e/tsconfig.json
```

`cockpit/ag-ui/tool-views/angular/e2e/playwright.config.ts`:

```ts
// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test';
import { portsFor } from '../../../../../cockpit/ports.mjs';

const { angular: angularPort } = portsFor('cockpit-ag-ui-tool-views-angular');

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${angularPort}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('../../../../../libs/e2e-harness/src/global-teardown'),
});
```

`cockpit/ag-ui/tool-views/angular/e2e/global-setup-impl.ts`:

```ts
// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { portsFor } from '../../../../../cockpit/ports.mjs';
import { createAgUiGlobalSetup } from '@threadplane-internal/e2e-harness';

const ports = portsFor('cockpit-ag-ui-tool-views-angular');

export default createAgUiGlobalSetup({
  pythonCwd: 'cockpit/ag-ui/tool-views/python',
  backendPort: ports.langgraph,
  angularProject: 'cockpit-ag-ui-tool-views-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

- [ ] **Step 2: Write the aimock fixture (two-stage tool call)**

`cockpit/ag-ui/tool-views/angular/e2e/fixtures/tool-views.json`:

```json
{
  "fixtures": [
    {
      "match": {
        "userMessage": "What's the weather in San Francisco?",
        "hasToolResult": true
      },
      "response": {
        "content": "Here's the current weather for San Francisco."
      }
    },
    {
      "match": {
        "userMessage": "What's the weather in San Francisco?"
      },
      "response": {
        "toolCalls": [
          {
            "name": "weather_card",
            "arguments": {
              "location": "San Francisco"
            }
          }
        ]
      }
    }
  ]
}
```

- [ ] **Step 3: Write the e2e spec**

`cockpit/ag-ui/tool-views/angular/e2e/tool-views.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '@threadplane-internal/e2e-harness';

test('tool-views: weather_card tool call renders the registered component with result values', async ({ page }) => {
  await submitAndWaitForResponse(page, "What's the weather in San Francisco?");

  // The registered WeatherCardComponent (app-weather-card) must mount for the
  // weather_card tool call and show the deterministic result. Proves: aimock
  // returned the tool call, ag-ui-langgraph emitted TOOL_CALL_* events, the
  // adapter reduced them into toolCalls(), and the chat composition bridged
  // the call into the views registry via the synthetic-spec path.
  const card = page.locator('app-weather-card');
  await expect(card).toBeVisible({ timeout: 30000 });
  await expect(card).toContainText('San Francisco');
  await expect(card).toContainText('68');
});
```

- [ ] **Step 4: Write the manual record harness**

`cockpit/ag-ui/tool-views/angular/e2e/manual/tool-views.manual.ts`:

```ts
// SPDX-License-Identifier: MIT
// Manual record-mode harness. Run against a live OpenAI key to capture new
// fixture entries into cockpit/ag-ui/tool-views/angular/e2e/fixtures/tool-views.json.
//
// Prerequisites:
//   1. Start the uvicorn backend in record mode (OPENAI_API_KEY set, no aimock):
//        cd cockpit/ag-ui/tool-views/python && uv run uvicorn src.server:app --port 5322
//   2. Start the Angular dev server:
//        npx nx serve cockpit-ag-ui-tool-views-angular
//   3. Run this harness via:
//        npx playwright test --config cockpit/ag-ui/tool-views/angular/e2e/playwright.config.ts \
//          manual/tool-views.manual.ts --headed
import { expect, test } from '@playwright/test';

test.describe('AG-UI Tool Views Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4322');
    await page.waitForSelector('app-tool-views', { state: 'attached' });
  });

  test('renders the weather card for a weather question', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', "What's the weather in San Francisco?");
    await page.click('button[type="submit"]');
    await expect(page.locator('app-weather-card')).toBeVisible({ timeout: 30000 });
  });
});
```

- [ ] **Step 5: Run the e2e to verify**

Run: `npx nx e2e cockpit-ag-ui-tool-views-angular`
Expected: PASS — the weather card renders with "San Francisco" and "68". (The global setup starts the uvicorn backend under aimock with the fixtures, then the Angular dev server.)

If the run fails because the assistant text never settles, confirm the fixture `userMessage` strings match the exact prompt sent by the spec, and that `hasToolResult: true` is on the FIRST (more specific) fixture so aimock prefers it once the tool result is in context.

- [ ] **Step 6: Commit**

```bash
git add cockpit/ag-ui/tool-views/angular/e2e/
git commit -m "test(cockpit): ag-ui tool-views e2e fixture + spec"
```

---

## Task 7: Registry + manifest wiring, then full verification

Register the new capability across the four registries so cockpit nav, ports, proxy, route resolution, and the wiring parity test all recognize it.

**Files:**
- Modify: `cockpit/ports.mjs:29` (after the streaming entry)
- Modify: `apps/cockpit/scripts/capability-registry.ts:54` (after the streaming entry)
- Modify: `apps/cockpit/src/lib/route-resolution.ts` (import line 15-area + array line 87-area)
- Modify: `libs/cockpit-registry/src/lib/manifest.ts:35`

- [ ] **Step 1: Add the port pair**

In `cockpit/ports.mjs`, after the line `'cockpit-ag-ui-streaming-angular':  { angular: 4321, langgraph: 5321 },` add:

```js
  'cockpit-ag-ui-tool-views-angular': { angular: 4322, langgraph: 5322 },
```

- [ ] **Step 2: Add the capability-registry entry**

In `apps/cockpit/scripts/capability-registry.ts`, after the `ag-ui-streaming` entry (line 54) add:

```ts
  { id: 'ag-ui-tool-views', product: 'ag-ui', topic: 'tool-views', angularProject: 'cockpit-ag-ui-tool-views-angular', port: 4322, pythonPort: 5322, pythonDir: 'cockpit/ag-ui/tool-views/python' },
```

- [ ] **Step 3: Register the route-resolution module**

In `apps/cockpit/src/lib/route-resolution.ts`, add the import after line 15 (`agUiStreamingPythonModule`):

```ts
import { agUiToolViewsPythonModule } from '../../../../cockpit/ag-ui/tool-views/python/src/index';
```

And in the `capabilityModules` array, after `agUiStreamingPythonModule,` (line 87) add:

```ts
  agUiToolViewsPythonModule,
```

- [ ] **Step 4: Add the manifest topic**

In `libs/cockpit-registry/src/lib/manifest.ts`, change the `'ag-ui'` core-capabilities list (line 35) from:

```ts
    'core-capabilities': ['streaming', 'interrupts'],
```

to:

```ts
    'core-capabilities': ['streaming', 'interrupts', 'tool-views'],
```

- [ ] **Step 5: Run the wiring parity test**

Run: `npx nx test cockpit -- --run cockpit-e2e-wiring`
Expected: PASS — registry/ports/proxy/global-setup all aligned for `cockpit-ag-ui-tool-views-angular`. (The scope-tag test excludes `/ag-ui/` paths, so ag-ui caps need no scope tags — though we added them on the python project to mirror the sibling.)

- [ ] **Step 6: Run the route-resolution + manifest tests**

Run: `npx nx test cockpit -- --run route-resolution`
Expected: PASS — the new module resolves and the manifest entry for `ag-ui/core-capabilities/tool-views` is present.

Run: `npx nx test cockpit-registry -- --run`
Expected: PASS — `validate-manifest` accepts the new `tool-views` entry.

- [ ] **Step 7: Build the smoke targets across the new cap**

Run: `npx nx run-many -t smoke -p cockpit-ag-ui-tool-views-python cockpit-ag-ui-tool-views-angular`
Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add cockpit/ports.mjs apps/cockpit/scripts/capability-registry.ts \
        apps/cockpit/src/lib/route-resolution.ts libs/cockpit-registry/src/lib/manifest.ts
git commit -m "feat(cockpit): register ag-ui tool-views capability (ports, registry, route, manifest)"
```

- [ ] **Step 9: Full lint + affected verification**

Run: `npx nx run-many -t lint -p chat cockpit cockpit-registry cockpit-ag-ui-tool-views-angular cockpit-ag-ui-tool-views-python`
Expected: PASS.

Run: `git grep -in "copilot\|hashbrown" cockpit/ag-ui/tool-views libs/chat/src/lib/primitives/chat-tool-views docs/superpowers/specs/2026-06-06-ag-ui-tool-views-design.md docs/superpowers/plans/2026-06-06-ag-ui-tool-views.md`
Expected: NO matches (constraint upheld across all new artifacts).

---

## Self-Review

**Spec coverage:**
- Reuse `views` input via synthetic-element bridge → Task 2 (`toToolViewSpec`) + Task 3 (mount).
- Progressive + status-aware rendering (args while running, result on complete, `status`) → Task 2 spec tests; `WeatherCardComponent.pending` in Task 5.
- Auto-exclude matched tool names from default card → Task 3 Step 3 (`excludedToolNames`).
- Shared `resolveMessageToolCalls` util → Task 1.
- One registry / reusable components → Task 5 (`views({ weather_card })`); docs guide Tip.
- `ag-ui/tool-views` example (ports 4322/5322, `weather_card`) → Tasks 4–6.
- Wiring checklist (ports, capability-registry, route-resolution, manifest, Railway auto-pickup) → Task 7. (Railway generator reads the capability-registry, so no manual deploy wiring is needed — covered by the Task 2 registry add.)
- Error handling: unregistered name → default card (Task 2 test "renders nothing for an unregistered tool name" + the card still shows because it's NOT excluded); `views` undefined → nothing (Task 2 test).
- Testing: lib vitest (Task 2), shared-util test (Task 1), smoke (Tasks 4/5), e2e fixture (Task 6).

**Placeholder scan:** No TBD/TODO. Every code step shows full file content or an exact edit. The one judgement call — `main.ts`/`main.cockpit.ts` bootstrap wiring (Task 5 Step 8) — is spelled out with the bootstrap call and an instruction to copy the cockpit-shell providers verbatim from the streaming sibling, because that file's exact extra-provider block isn't reproduced here.

**Type consistency:** `resolveMessageToolCalls(agent, message)` signature is identical in Task 1 (definition), Task 2 (`ChatToolViewsComponent` consumer), and Task 1 Step 5 (`ChatToolCallsComponent` consumer). `toToolViewSpec` returns `Spec` (`{ root, elements }`) matching `@json-render/core`. View component input names (`location`, `temperatureF`, `conditions`, `humidity`, `windMph`, `status`) match the `weather_card` tool's returned dict keys in Task 4 exactly, so the synthetic-spec props resolve to the declared inputs.
