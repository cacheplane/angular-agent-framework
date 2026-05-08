# Canonical `@ngaf/chat` demo (`examples/chat/`) — Phase 1 design

**Date:** 2026-05-08
**Status:** Phase 1 of a phased roadmap
**Replaces:** `examples/chat-agent/`

## Goal

Build the canonical, full-stack demo for `@ngaf/chat`: a single Angular
application that exercises the three chat compositions (embed, popup,
sidebar), regenerate, the model picker, markdown surfaces, and a debug
overlay — all driven by a tiny LangGraph backend, framed by a floating
control palette. Ship alongside an interactive smoke generator that
recreates a fresh, npm-installed consumer of the same surface for
release-validation smoke.

The demo serves two audiences:

- **External users learning the framework** — clone, run, see all the
  major surfaces work end-to-end in five minutes.
- **Internal release validators** — run the smoke generator after a
  publish to confirm the published packages still behave correctly in
  a clean consumer.

## Non-goals (deferred to later phases)

The demo intentionally does **not** cover the following in Phase 1.
Each is a separate sub-project with its own spec → plan → PR cycle,
layered onto this demo:

- Reasoning blocks (gpt-5 `reasoning` content type)
- Tool calls
- Subagents
- Interrupts / human-in-the-loop
- Citations
- Generative UI (A2UI)
- Time travel / timeline
- Multi-thread switcher

Each of those will land as a new mode component (or new section in an
existing mode), a new section in the smoke checklist, and matching
backend support.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                       examples/chat/                               │
│  ┌─────────────────┐    ┌─────────────────┐   ┌────────────────┐  │
│  │  angular/       │    │  python/        │   │  smoke/        │  │
│  │  workspace-     │◄───┤  LangGraph      │   │  CLI generator │  │
│  │  linked         │    │  graph (LLM)    │   │                │  │
│  │  Angular app    │    │  uv + langgraph │   │                │  │
│  │  (the demo)     │    │  serves :2024   │   │                │  │
│  │                 │    │                 │   │                │  │
│  │  components ────┼────┼─────────────────┼──►│  copies into   │  │
│  │  + chrome       │    │                 │   │  fresh tmp     │  │
│  │  palette        │    │                 │   │  consumer      │  │
│  └─────────────────┘    └─────────────────┘   └────────────────┘  │
│           ▲                                          │             │
│           │ workspace-linked libs/* (dev)            │ npm @ngaf/* │
│           │                                          ▼             │
│  ┌────────────────┐                          ┌─────────────────┐  │
│  │  libs/chat,    │                          │  ~/tmp/ngaf/    │  │
│  │  libs/langgraph│                          │  (default       │  │
│  │  ...           │                          │   target dir)   │  │
│  └────────────────┘                          └─────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

Two consumers, one source of truth: the demo's `src/app/` is the
canonical chat-app shape. The smoke CLI copies that same `src/app/`
into a freshly-scaffolded npm consumer — so the released `@ngaf/*`
packages get exercised against the *same* UI the workspace dev sees.

## Directory layout

```
examples/chat/
├── README.md                       # External onboarding + internal smoke runbook
├── project.json                    # Aggregate Nx target: `serve` runs angular + python concurrently
│
├── angular/                        # Workspace-linked dev demo
│   ├── project.json                # Angular CLI / Nx targets: serve, build, lint, test
│   ├── package.json                # Demo's deps (workspace * for @ngaf/*)
│   ├── tsconfig.json
│   ├── angular.json
│   ├── src/
│   │   ├── main.ts                 # Bootstrap + provideAgent
│   │   ├── styles.css              # Loads @ngaf/chat/chat.css
│   │   └── app/
│   │       ├── app.config.ts       # provideAgent({ apiUrl: 'http://localhost:2024' })
│   │       ├── app.routes.ts       # Path-based routes for embed/popup/sidebar
│   │       ├── app.ts              # Root component (RouterOutlet + nothing else)
│   │       ├── shell/
│   │       │   ├── demo-shell.component.ts    # Layout host, owns shared agent
│   │       │   ├── demo-shell.component.html
│   │       │   ├── demo-shell.component.css
│   │       │   ├── shell-tokens.ts            # DEMO_AGENT InjectionToken
│   │       │   ├── control-palette.component.ts  # Floating widget
│   │       │   ├── control-palette.component.html
│   │       │   ├── control-palette.component.css
│   │       │   └── palette-persistence.service.ts  # localStorage read/write
│   │       └── modes/
│   │           ├── embed-mode.component.ts    # Hosts <chat>
│   │           ├── popup-mode.component.ts    # Hosts <chat-popup>
│   │           └── sidebar-mode.component.ts  # Hosts <chat-sidebar>
│   └── public/
│
├── python/                         # Tiny LangGraph server
│   ├── pyproject.toml              # uv-managed
│   ├── langgraph.json              # graphs.chat → ./src/graph.py:graph
│   ├── README.md
│   ├── .env.example                # OPENAI_API_KEY=...
│   ├── src/
│   │   └── graph.py                # ~50 LOC: single-node, ChatOpenAI, state.model
│   └── tests/
│       └── test_graph_smoke.py     # Pytest smoke (graph imports + state shape)
│
└── smoke/                          # Interactive CLI for npm-installed smoke consumer
    ├── project.json                # Nx targets: run, lint
    ├── cli.mjs                     # ~150 LOC dependency-free Node ESM
    ├── template/                   # Frozen consumer skeleton (no src/app/)
    │   ├── package.json            # @ngaf/* @ "^*" — replaced at gen-time
    │   ├── angular.json
    │   ├── tsconfig.json / .app.json / .spec.json
    │   ├── public/
    │   │   └── favicon.ico
    │   └── src/
    │       ├── main.ts
    │       └── styles.css          # Loads @ngaf/chat/chat.css
    │       # (NO app/ directory — copied from ../../angular/src/app/ at gen-time)
    ├── CHECKLIST.md                # Manual validation steps
    └── README.md                   # How to run the generator
```

## Angular demo internals

### Routes

```ts
// examples/chat/angular/src/app/app.routes.ts
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'embed' },
  {
    path: '',
    component: DemoShell,
    children: [
      { path: 'embed',   component: EmbedMode },
      { path: 'popup',   component: PopupMode },
      { path: 'sidebar', component: SidebarMode },
    ],
  },
  { path: '**', redirectTo: 'embed' },
];
```

### Shared agent via DI token

The shell creates one agent instance and provides it to all routed
mode children. The router never unmounts the shell, so the instance
survives `/embed → /popup → /sidebar` navigations and the
conversation continues uninterrupted.

```ts
// shell-tokens.ts
export const DEMO_AGENT = new InjectionToken<LangGraphAgent>('DEMO_AGENT');

// demo-shell.component.ts
@Component({
  selector: 'demo-shell',
  templateUrl: './demo-shell.component.html',
  imports: [RouterOutlet, ControlPalette, ChatDebug],
  providers: [
    { provide: DEMO_AGENT, useFactory: () => inject(DemoShell).agent },
  ],
})
export class DemoShell {
  protected readonly model = signal<string>(this.persistence.read('model') ?? 'gpt-5-mini');
  protected readonly debugOpen = signal<boolean>(this.persistence.read('debug') ?? false);

  // Thread persisted across reloads so a mid-conversation page reload
  // reconnects to the same thread (history reappears from server state).
  // The signal is reactive — onThreadId writes back when the SDK creates
  // a new thread server-side; we mirror that to localStorage.
  private readonly threadIdSignal = signal<string | null>(
    this.persistence.read('threadId'),
  );

  protected readonly agent = (() => {
    const a = agent({
      apiUrl: 'http://localhost:2024',
      assistantId: 'chat',
      threadId: this.threadIdSignal,
      onThreadId: (id: string) => {
        this.threadIdSignal.set(id);
        this.persistence.write('threadId', id);
      },
    });
    const orig = a.submit.bind(a);
    (a as { submit: typeof a.submit }).submit = ((input, opts) =>
      orig({ ...(input ?? {}), state: { ...(input?.state ?? {}), model: this.model() } }, opts)
    ) as typeof a.submit;
    return a;
  })();

  /**
   * Reset the conversation: clear the persisted thread id, drop the
   * signal so a new thread is created on the next submit. Wired to a
   * "New conversation" button in the palette.
   */
  protected newConversation(): void {
    this.persistence.write('threadId', null);
    this.threadIdSignal.set(null);
  }
}
```

```ts
// modes/embed-mode.component.ts (sample — popup/sidebar follow the same shape)
@Component({
  selector: 'embed-mode',
  imports: [ChatComponent, ChatWelcomeSuggestionComponent],
  template: `
    <chat
      [agent]="agent"
      [modelOptions]="modelOptions()"
      [(selectedModel)]="model"
    >
      <div chatWelcomeSuggestions>
        @for (s of suggestions(); track s.value) {
          <chat-welcome-suggestion [label]="s.label" [value]="s.value" (selected)="send($event)" />
        }
      </div>
    </chat>
  `,
})
export class EmbedMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly model = inject(DemoShell).model;
  // ...
}
```

### Mode segmented control

The palette emits navigation. The shell observes the router URL via
`toSignal(router.events.pipe(map(() => router.url)))` and projects a
read-only `mode` signal back to the palette so the segmented control
stays in sync (URL is the single source of truth).

### Control palette

Fixed-position widget, top-right corner, 12px viewport inset. Four
controls stacked vertically:

```
┌──────────────────────────────┐
│  [Embed][Popup][Sidebar]     │  ← segmented mode selector → router.navigate
│  gpt-5-mini ▾                │  ← model dropdown
│  🐛 Debug   ◉  ON / ○ OFF    │  ← toggle
│  ↻ New conversation          │  ← clears persisted threadId; next submit creates new thread
│  ─────                       │
│  ⌃ collapse                  │
└──────────────────────────────┘
```

Collapsed state: a single 32×32 icon button in the corner. Click expands.
Collapse state and all selections persisted in `localStorage` under the
key `ngaf-chat-demo:palette` (single JSON object). Mode selection is
NOT in localStorage — that's the URL's job.

### Debug overlay

When `debugOpen()` is true, the shell mounts `<chat-debug>` (the
existing primitive in `@ngaf/chat`) as a sibling to the routed mode.
Position: bottom drawer, full width, 30vh tall, drag-handle to resize.
When the toggle flips off, `<chat-debug>` is unmounted entirely (no
DOM, no signal subscriptions).

### Markdown surfaces

No demo-side code. The existing `<chat-streaming-md>` component (the
0.0.20 partial-markdown swap) renders markdown. The demo's role: ship
welcome suggestions that elicit markdown-rich responses so external
users see headings, bullets, ordered lists, fenced code, tables, task
lists, blockquotes, and links work first time:

- "Tell me about coral reefs"
- "Write a haiku about Angular"
- "List 5 productivity tips, in markdown bullets."
- "Show me a table comparing Angular signals, RxJS, and zone.js — three columns: name, mental model, when to use."
- "Explain promises with a code block in TypeScript."

## Python graph

`examples/chat/python/src/graph.py` is a single-node graph mirroring
the shape that `~/tmp/ngaf-llm-backend/src/graph.py` has been smoking
against during 0.0.27/0.0.28/0.0.29 development. The shape that
exercises the regenerate path (`__start__ → generate → __end__`) is
the same shape this demo needs.

```python
from typing import Annotated, Optional
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

SYSTEM_PROMPT = (
    "You are a helpful, concise assistant. "
    "Format responses with markdown when useful (headings, lists, code blocks, tables)."
)

REASONING_PREFIXES = ("gpt-5", "o1", "o3", "o4")
def _is_reasoning_model(name: str) -> bool:
    return any(name.startswith(p) for p in REASONING_PREFIXES)


class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]


async def generate(state: State) -> dict:
    model_name = state.get("model") or "gpt-5-mini"
    kwargs = {"model": model_name, "streaming": True}
    if _is_reasoning_model(model_name):
        kwargs["reasoning"] = {"effort": "minimal"}  # quick first-token streaming
    llm = ChatOpenAI(**kwargs)
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = await llm.ainvoke(messages)
    return {"messages": [response]}


_b = StateGraph(State)
_b.add_node("generate", generate)
_b.set_entry_point("generate")
_b.add_edge("generate", END)
graph = _b.compile()
```

### Why this shape

- `state.model` flows the demo's model picker through state (not
  config) — picker change applies to every turn without reconnecting.
- `reasoning_effort: "minimal"` is forced for gpt-5* so streaming
  fires from the first token. Reasoning-effort tuning is deferred to
  the reasoning phase.
- Single node, `__start__ → generate → __end__`. Matches the surface
  the regenerate path (and the 0.0.29 `as_node='__start__'` fix) needs
  to validate.
- No tool calls, interrupts, or human-in-the-loop. Each gets its own
  node + spec when its phase lands.

### Pytest smoke

```python
import pytest

@pytest.mark.smoke
def test_graph_imports():
    from chat_demo.graph import graph
    assert graph is not None

@pytest.mark.smoke
def test_state_shape():
    from chat_demo.graph import State
    assert "messages" in State.__annotations__
    assert "model" in State.__annotations__
```

Two trivial smokes — they catch import-time regressions (the kind that
broke `examples/chat-agent/` previously) without burning OpenAI tokens.
Live-LLM testing is the Angular smoke's job.

## Smoke CLI generator

### Invocation

```bash
nx run chat-smoke:run
# or, equivalently:
node examples/chat/smoke/cli.mjs
```

### Interactive flow

```
$ nx run chat-smoke:run

📦 NGAF chat smoke generator

? Target directory: (~/tmp/ngaf)
? Directory exists. Action?
   ❯ Refresh (delete + recreate)
     Update in place (skip scaffold, just bump deps)
     Cancel
? @ngaf version: (X.Y.Z — latest from npm)
? Run `npm install` now? (Y/n)
? Run `npm start` after install? (Y/n)

→ Copying scaffold from examples/chat/smoke/template/ ...
→ Copying examples/chat/angular/src/app/ ...
→ Writing package.json with @ngaf/* @ ^X.Y.Z ...
→ Writing .env.example ...
→ Writing CHECKLIST.md ...
→ Writing SMOKE_RUN.md (timestamp, versions, env capture) ...
→ npm install ...
✓ Smoke consumer ready at ~/tmp/ngaf
  Start backend:  cd examples/chat/python && uv run langgraph dev --port 2024
  Start app:      cd ~/tmp/ngaf && npm start
  Then visit:     http://localhost:4200
  Run checklist:  cat ~/tmp/ngaf/CHECKLIST.md
```

### Implementation notes

- Default target `~/tmp/ngaf`, overridable via the first prompt.
- "Directory exists" prompt offers three options; default is **Cancel**
  (safe destructive default — pressing Enter does nothing).
- "Update in place" mode skips the scaffold copy entirely and just
  bumps the `@ngaf/*` dep ranges in the existing `package.json`, then
  reinstalls.
- Version is resolved via `npm view @ngaf/chat version` (default), but
  the prompt accepts an explicit version.
- The CLI is plain Node ESM, ~150 LOC, no external dependencies. Uses
  `node:readline/promises` for prompts, `node:fs/promises` for file
  operations, `node:child_process` for `npm` invocation.

### Why partial scaffold

`smoke/template/` ships everything *except* `src/app/`. The CLI copies
`examples/chat/angular/src/app/` into the generated dir at run time.
Result: the smoke generator's reviewable surface (the template) is
just the Angular CLI scaffold. The actual app code is always the live
demo's. If a contributor adds a new mode component, the next smoke
run picks it up automatically — no template drift.

### Version placeholder

`smoke/template/package.json` ships with `"@ngaf/chat": "*"` (and
likewise for the other `@ngaf/*` packages). `*` is a valid semver
range meaning "any version" — so the template is syntactically valid
and can be lint-checked, prettier-formatted, or even directly
`npm install`ed without errors.

At generate-time the CLI rewrites `*` into the explicit `^X.Y.Z`
range it resolved (default: latest from npm). The generated
consumer's `package.json` thus pins the exact version surface that
was smoked, and `SMOKE_RUN.md` captures the same number for the
record.

### `SMOKE_RUN.md` capture

Auto-generated in the target dir at gen-time:

```markdown
# Smoke run capture

- Timestamp: 2026-05-08T14:23:11Z
- ngaf version: 0.0.29
- Backend git SHA: 56b54338
- Node: v22.14.0
- npm: 10.9.2
- Angular CLI: 21.2.10
- Resolved @ngaf packages:
  - @ngaf/chat@0.0.29
  - @ngaf/langgraph@0.0.29
  - ...
- Resolved @cacheplane packages:
  - @cacheplane/partial-markdown@0.3.2
  - @cacheplane/partial-json@0.2.1
```

When an external user reports breakage, this file is one paste.

## CHECKLIST.md

Comprehensive Phase 1 manual validation checklist with empty Phase 2+
sections that get populated as features land. The full checklist is
included verbatim below — committed as `examples/chat/smoke/CHECKLIST.md`
and copied into each generated smoke consumer:

```markdown
# NGAF chat smoke checklist

Scope: validates the **published** `@ngaf/*` packages render and behave
correctly in a fresh consumer. Run after any release or whenever
changes land in libs/chat, libs/langgraph, libs/render, libs/ag-ui.

## Pre-flight

- [ ] `OPENAI_API_KEY` present in `examples/chat/python/.env`
- [ ] `nx run chat-python:serve` running on :2024 — `curl localhost:2024/ok` returns `{"ok":true}`
- [ ] Smoke consumer started — page loads at :4200
- [ ] No console errors on initial load (license warning OK, telemetry DNS failure OK)
- [ ] No 4xx/5xx in the network tab on initial load

## Initial render (welcome state)

- [ ] Default route redirects to `/embed`
- [ ] Welcome heading renders ("How can I help?")
- [ ] All declared welcome suggestion buttons render with their labels
- [ ] Control palette renders top-right, fully expanded by default
- [ ] Palette mode segmented control highlights "Embed"
- [ ] Palette model dropdown shows the default model
- [ ] Palette debug toggle shows "off"
- [ ] Send button disabled when input is empty

## Send & receive (basic streaming)

- [ ] Type any prompt, click Send — input clears, user message renders immediately
- [ ] Typing indicator appears between send and first token
- [ ] Tokens stream visibly into the assistant bubble (not all-at-once)
- [ ] Final message stays after stream completes
- [ ] Auto-scroll keeps the latest content visible during streaming
- [ ] Send button re-enables after stream completes

## Stop mid-stream

- [ ] Send a long prompt
- [ ] Mid-stream, Send button has flipped to "Stop generating"
- [ ] Click stop — stream halts, partial response remains rendered
- [ ] No console errors; agent returns to idle; Send button returns

## Markdown surfaces (the partial-markdown render path)

Send a prompt that asks for each of the following. Check that each
renders correctly both during streaming and after completion.

> **Known regressions** documented in the chat 0.0.20 partial-markdown
> swap: tables and task lists may not match the previous (marked-based)
> rendering exactly. If a check fails, file an issue against
> `libs/chat` rather than skipping — the smoke checklist is the
> canonical "what should work" list.

- [ ] **Headings** — `# H1`, `## H2`, `### H3` all render at distinct sizes
- [ ] **Paragraphs** with **bold**, *italic*, and `inline code`
- [ ] **Bullet lists** including nested (2+ levels)
- [ ] **Ordered lists** with correct numbering
- [ ] **Task lists** — `- [ ]` (unchecked) and `- [x]` (checked) render as checkboxes
- [ ] **Fenced code blocks** with language hint — preserved as `<pre><code>`
- [ ] **Tables** with header row + 2+ data rows — column alignment preserved
- [ ] **Blockquotes** — visually distinct
- [ ] **Links** — clickable, open in new tab
- [ ] **Horizontal rules** — render as a line
- [ ] No raw HTML escapes through (e.g. `<script>` displayed as text, not executed)

### Streaming-specific markdown checks

- [ ] Mid-stream, an incomplete fenced code block (open ``` no close) renders
      as a code block (does not flash to plain text)
- [ ] Mid-stream, an incomplete table row does not corrupt the table
- [ ] No visible flicker / layout shift as tokens arrive
- [ ] Long response keeps autoscrolling to bottom

## Regenerate

- [ ] After a response completes, hover the assistant message — actions row appears
- [ ] "Regenerate response" button is present and enabled
- [ ] Click regenerate — old assistant message is replaced (not appended)
- [ ] Typing indicator appears, then tokens stream into the new assistant slot
- [ ] After completion, exactly **1 user / 1 assistant** in the conversation
      (NOT 1u/0a, NOT 1u/2a, NOT 2u/2a)
- [ ] Server-side state matches: `curl localhost:2024/threads/<id>/state`
      returns 2 messages with `next: []`
- [ ] Repeated regenerate (3 times in a row) keeps state at 1u/1a each time

## Cross-mode persistence

- [ ] In `/embed`, send a message
- [ ] Navigate to `/popup` — same conversation visible
- [ ] Open the popup — message history is intact
- [ ] Navigate to `/sidebar` — same conversation
- [ ] Open the sidebar — message history is intact
- [ ] Send from `/sidebar`, navigate back to `/embed` — new message present

## Mode switching (route + URL)

- [ ] `/embed` renders `<chat>` inline, full viewport
- [ ] `/popup` renders a launcher button; clicking opens a floating window
      with `role="dialog"`, contains the chat
- [ ] `/sidebar` renders a launcher; clicking slides in a panel with
      `role="complementary"`
- [ ] Browser back/forward navigates between modes correctly
- [ ] Direct deep-link to `/popup` works (no flash of `/embed` first)
- [ ] Unknown route (`/foo`) redirects to `/embed`
- [ ] Closing the popup does not navigate; URL stays `/popup`
- [ ] Same for sidebar close

## Model picker

- [ ] Palette dropdown lists the configured models
- [ ] Selecting a different model — palette text updates immediately
- [ ] Send a message — backend log shows the new model name
      (or check `/threads/<id>/state` `values.model` field)
- [ ] Selection persists across page reload
- [ ] Selection persists across mode switches

## Debug overlay

- [ ] Toggle Debug ON in palette
- [ ] `<chat-debug>` overlay appears (bottom drawer)
- [ ] Debug overlay shows current agent signals (status, message count, etc.)
- [ ] Debug overlay updates live as messages stream
- [ ] Toggle Debug OFF
- [ ] Overlay unmounts; no console errors; DOM has no `<chat-debug>` element

## Control palette UX

- [ ] Click collapse handle — palette shrinks to single icon
- [ ] Click icon — palette re-expands
- [ ] Collapsed/expanded state persists across reload
- [ ] Palette never overlaps the chat input (must remain accessible)
- [ ] Palette is positioned above any popup/sidebar in z-order

## Keyboard & accessibility

- [ ] Tab order reaches: input, send button, suggestions (when shown),
      palette controls, message actions (when hovered/focused)
- [ ] Enter in input — sends message
- [ ] Shift+Enter in input — inserts newline (does not send)
- [ ] Escape closes popup or sidebar (when open)
- [ ] Send button has accessible name "Send message"
- [ ] Stop button (mid-stream) has accessible name "Stop generating"
- [ ] Regenerate button has accessible name "Regenerate response"
- [ ] Copy button has accessible name "Copy to clipboard" → "Copied"
- [ ] Popup window has `role="dialog"`
- [ ] Sidebar panel has `role="complementary"` and `aria-hidden` toggles correctly

## Error handling

- [ ] Stop the Python server (`Ctrl+C` on :2024) and try sending — UI
      surfaces an error in `<chat-error>`, does not crash
- [ ] Restart Python server and send again — recovers without reload
- [ ] Send with `OPENAI_API_KEY` invalid — error surfaces; no infinite spinner

## Lifecycle

- [ ] Reload the page mid-conversation — agent reconnects, history reappears
      from server state (NOT fresh empty state)
- [ ] Click "New conversation" in palette — welcome state reappears, prior
      conversation is no longer attached (next submit creates a new thread server-side)
- [ ] Browser back navigates routes correctly
- [ ] Selecting a welcome suggestion sends and clears the welcome state

## Browser hygiene

- [ ] No `console.error` after smoke run completes
- [ ] No `Uncaught` promise rejections
- [ ] No memory leak across 10 mode-switch cycles (DevTools heap snapshot
      stable, no detached `<chat-message>` nodes)
- [ ] Network tab — no failed `localhost:2024` requests except the
      well-known `runs/stream` `ERR_ABORTED` (SSE terminus, expected)

## Visual polish

- [ ] Chat content readable at default zoom
- [ ] Layout responsive: viewport at 1440px, 1024px, 768px, 480px — no
      horizontal overflow, palette stays in viewport
- [ ] Markdown styles match the rest of the app's typography
- [ ] No flash of unstyled content on initial load

## Capture

- [ ] If anything failed, capture: `SMOKE_RUN.md` (auto-generated by CLI),
      console logs (last 100 lines), network tab HAR export, screenshot.

---

# Phase 2+ sections (intentionally empty in Phase 1)

## Reasoning blocks

## Tool calls

## Interrupts / human-in-the-loop

## Citations

## Generative UI / A2UI surfaces

## Subagents

## Time travel / timeline

## Multi-thread
```

## README.md (`examples/chat/README.md`)

Two audiences in one document, structured with explicit anchors:

```markdown
# examples/chat — canonical demo for @ngaf/chat

Full-stack demo of `@ngaf/chat` against a tiny LangGraph backend.
Three chat compositions (embed, popup, sidebar), regenerate, model
picker, debug overlay — all in one page, switchable via a floating
control palette.

## Quick start (5 minutes)

[external user onboarding — clone, install, run]

## Architecture

[high-level: angular/ + python/ + smoke/, what's where, how they talk]

## Working on the demo

[for contributors: nx run chat:serve, what reloads, how to add a mode]

## Release smoke

[for release validators: nx run chat-smoke:run, how to step through
 CHECKLIST.md, how to capture results]

## Roadmap

[Phase 1 features (this doc), what's in Phase 2+, link to specs/]
```

## Build / Nx wiring

Three new Nx projects:

| Project | Path | Targets |
|---|---|---|
| `chat-angular` | `examples/chat/angular` | `serve`, `build`, `lint`, `test` |
| `chat-python` | `examples/chat/python` | `serve`, `test`, `smoke` |
| `chat-smoke` | `examples/chat/smoke` | `run`, `lint` |

Plus an aggregate `chat` target in `examples/chat/project.json` wiring
`nx run chat:serve` to run `chat-angular:serve` and `chat-python:serve`
concurrently.

## CI changes

Add to existing `Library — lint / test / build` job:

- `nx run chat-angular:lint test build`
- `nx run chat-python:test`
- `nx run chat-smoke:lint`

**No live-LLM CI.** The smoke generator is **not** auto-run on PRs —
it's an on-demand tool for humans validating a release. Auto-running
would burn OpenAI tokens on every PR and not catch anything `nx test`
doesn't already cover.

## Cleanup

`examples/chat-agent/` is removed in the same PR. Its surface (a tiny
Python `MessagesState` graph + two pytest smokes) is fully subsumed
by `examples/chat/python/`.

```bash
rm -rf examples/chat-agent
```

Also remove from any references:

- `nx.json` (project list, if present)
- root `package.json` workspaces / scripts (if present)
- `apps/website/content/` (any docs referencing the path)
- CI workflows that build/smoke it

Verification: `grep -r "chat-agent" --include='*.{json,md,yml,yaml,ts,js}' .`
returns nothing besides historical CHANGELOG mentions.

## `.gitignore` additions

```
.superpowers/
```

(brainstorming server output — pin it now.)

## Definition of done (Phase 1)

All of the following true:

1. PR merged with `examples/chat/{angular,python,smoke}/` introduced and
   `examples/chat-agent/` removed.
2. `nx run chat:serve` works locally — Angular at :4200, Python at :2024,
   both reload on file save.
3. `nx run chat-smoke:run` defaults to `~/tmp/ngaf`, generates a working
   consumer, the consumer's `npm start` succeeds against the workspace's
   Python backend.
4. The full Phase 1 checklist runs green against the generated smoke
   consumer using the latest published `@ngaf/*` versions.
5. README explains both audiences clearly enough that a fresh contributor
   can get to step (2) without asking.

## Risks / known unknowns

- **Smoke template Angular version drift.** As Angular majors rev, the
  checked-in `smoke/template/` will fall behind. Mitigation: a manual
  "regenerate template" task in a later phase — `ng new` into a tmp dir,
  diff, commit. Document in `smoke/README.md`.
- **Smoke template can be accidentally treated as a real consumer.**
  Because the placeholder is `*` (valid semver), `npm install` in the
  template won't fail — it'll just install whatever's latest. Mitigation:
  the template's README explicitly states "this is a template, run the
  smoke CLI from the workspace root, not from this directory". Optional
  guardrail: a `prepare` script in `template/package.json` that errors
  if invoked from the template's own dir (vs. a generated copy).
- **Workspace + npm-installed in same monorepo can confuse contributors.**
  Mitigation: `examples/chat/angular/` README and the smoke generator
  both clearly state which they are. The smoke output dir is outside the
  repo (`~/tmp/`) by default, reinforcing the boundary.
- **Recreating `~/tmp/ngaf` overwrites a directory the user has been
  treating as personal scratch.** Mitigation: the CLI's "directory
  exists" prompt explicitly lists "Update in place" as an option for
  non-destructive bumps, and "Cancel" is the default if the user just
  hits Enter on a destructive choice.

## Roadmap (Phase 2+)

Each layer below ships as its own spec → plan → PR cycle, layered onto
the demo. New mode components (or new sections inside existing modes)
get added; the Phase 2+ section in `CHECKLIST.md` gets populated.

| Phase | Feature | Demo addition | Backend addition |
|---|---|---|---|
| 2 | Reasoning blocks | New welcome suggestion, render `<chat-reasoning>` inline | `reasoning_effort` toggle in palette |
| 2 | Tool calls | New welcome suggestion (`"What's the weather in Berlin?"`), render `<chat-tool-call-card>` | Add a `web_search` or `weather` tool node |
| 2 | Citations | Welcome suggestion that triggers RAG-style response, render `<chat-citations>` | Tool that returns `cited_sources` |
| 3 | Interrupts | New `/interrupts` route hosting `<chat-interrupt-panel>` | `interrupt()` node in graph |
| 3 | Subagents | Render `<chat-subagent-card>` | Add a subagent node |
| 4 | Generative UI | New `/generative` route | A2UI emitter node |
| 5 | Time travel | New `/timeline` route hosting `<chat-timeline-slider>` | Multi-checkpoint thread |
| 5 | Multi-thread | Add `<chat-thread-list>` to palette | Multiple threads |
