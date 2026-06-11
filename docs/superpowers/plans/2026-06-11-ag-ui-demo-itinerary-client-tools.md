# AG-UI Demo — Itinerary Client Tools + Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The public AG-UI demo gains a frontend-owned trip-itinerary (signals + localStorage) that the user edits in a side panel and the agent edits via five client tools, plus seven welcome suggestion chips covering the demo's full capability surface.

**Architecture:** All frontend state lives in a new `ItineraryStore`; the panel and the client-tool handlers are both thin consumers of it, so agent writes appear live. The backend binds the client catalog from `state["tools"]` via the published `threadplane-client-tools` middleware and ends the turn on pure client-tool calls. Spec: `docs/superpowers/specs/2026-06-11-ag-ui-demo-itinerary-client-tools-design.md`.

**Tech Stack:** Angular 20 signals, `@threadplane/chat` `tools()/action/view/ask`, `zod/v4`, LangGraph + `threadplane-client-tools` (PyPI), Playwright + aimock replay e2e, Vitest.

**Branch:** `claude/ag-ui-demo-client-tools` (exists; spec committed). Demo serve: angular `:4201`, backend uvicorn `:8000`.

**Constraints:** Never run `npm install`/regenerate the root `package-lock.json`. `uv lock`/`uv export` inside `examples/ag-ui/python` only. Never reference "copilotkit" or "hashbrown". `pyenv: cannot rehash` shell noise is benign.

---

### Task 1: `ItineraryStore` (TDD)

**Files:**
- Create: `examples/ag-ui/angular/src/app/itinerary-store.ts`
- Test: `examples/ag-ui/angular/src/app/itinerary-store.spec.ts`

- [ ] **Step 1: Write the failing tests** — cover: seed on empty storage; `add` appends with generated id + persists; `move` is case-insensitive on place and returns the stop (or `undefined` when absent); `clearDay` removes only that day; `remove(id)`; `reset()` restores the seed; hydration from a pre-populated `localStorage`. Use a fresh `localStorage.clear()` in `beforeEach`; instantiate via `TestBed.runInInjectionContext(() => new ItineraryStore())` only if injection is needed — prefer a plain class with no DI so tests are `new ItineraryStore()`.

```ts
// itinerary-store.spec.ts (shape — write all 7 cases)
import { describe, it, expect, beforeEach } from 'vitest';
import { ItineraryStore, ITINERARY_STORAGE_KEY } from './itinerary-store';

describe('ItineraryStore', () => {
  beforeEach(() => localStorage.clear());

  it('seeds the Paris trip when storage is empty', () => {
    const s = new ItineraryStore();
    expect(s.stops().length).toBe(3);
    expect(s.days()[0].day).toBe(1);
  });

  it('add appends a stop and persists it', () => {
    const s = new ItineraryStore();
    s.add(2, 'Sainte-Chapelle', 'morning');
    expect(s.stops().some((x) => x.place === 'Sainte-Chapelle')).toBe(true);
    expect(localStorage.getItem(ITINERARY_STORAGE_KEY)).toContain('Sainte-Chapelle');
  });

  it('move matches place case-insensitively and returns the stop', () => {
    const s = new ItineraryStore();
    const moved = s.move('louvre', 2);
    expect(moved?.day).toBe(2);
    expect(s.move('atlantis', 1)).toBeUndefined();
  });
  // …clearDay, remove, reset, hydrate cases
});
```

- [ ] **Step 2: Run to verify FAIL** — `npx nx test examples-ag-ui-angular -- itinerary-store` (file missing).
- [ ] **Step 3: Implement**

```ts
// itinerary-store.ts
// SPDX-License-Identifier: MIT
import { computed, signal } from '@angular/core';

export interface ItineraryStop { id: string; day: number; place: string; note?: string; }
export const ITINERARY_STORAGE_KEY = 'ag-ui-demo:itinerary';

const SEED: ItineraryStop[] = [
  { id: 'seed-1', day: 1, place: 'Louvre', note: 'book tickets' },
  { id: 'seed-2', day: 1, place: 'Eiffel Tower' },
  { id: 'seed-3', day: 2, place: "Musée d'Orsay" },
];

/** Frontend-owned demo state: the user edits it in the panel, the agent edits
 *  it through client tools. Both write the same signals, so either's changes
 *  render immediately. Persisted to localStorage so it survives reload. */
export class ItineraryStore {
  readonly stops = signal<ItineraryStop[]>(this.hydrate());
  readonly days = computed(() => {
    const byDay = new Map<number, ItineraryStop[]>();
    for (const s of this.stops()) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    return [...byDay.entries()].sort(([a], [b]) => a - b)
      .map(([day, stops]) => ({ day, stops }));
  });

  add(day: number, place: string, note?: string): ItineraryStop {
    const stop: ItineraryStop = { id: crypto.randomUUID(), day, place, ...(note ? { note } : {}) };
    this.update([...this.stops(), stop]);
    return stop;
  }
  move(place: string, toDay: number): ItineraryStop | undefined {
    const target = this.stops().find((s) => s.place.toLowerCase() === place.toLowerCase());
    if (!target) return undefined;
    const moved = { ...target, day: toDay };
    this.update(this.stops().map((s) => (s.id === target.id ? moved : s)));
    return moved;
  }
  remove(id: string): void { this.update(this.stops().filter((s) => s.id !== id)); }
  clearDay(day: number): number {
    const removed = this.stops().filter((s) => s.day === day).length;
    this.update(this.stops().filter((s) => s.day !== day));
    return removed;
  }
  reset(): void { this.update([...SEED]); }

  private update(next: ItineraryStop[]): void {
    this.stops.set(next);
    try { localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }
  private hydrate(): ItineraryStop[] {
    try {
      const raw = localStorage.getItem(ITINERARY_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ItineraryStop[];
    } catch { /* fall through to seed */ }
    return [...SEED];
  }
}
```

- [ ] **Step 4: Run to verify PASS** — same command.
- [ ] **Step 5: Commit** — `feat(examples/ag-ui): ItineraryStore — frontend-owned demo state`.

---

### Task 2: Itinerary panel + two-column layout

**Files:**
- Create: `examples/ag-ui/angular/src/app/itinerary-panel.component.ts`
- Modify: `examples/ag-ui/angular/src/app/app.ts` (provide one `ItineraryStore` instance), `app.html` (panel beside chat), demo stylesheet (`examples/ag-ui/angular/src/styles.css` or the component's styles — match the existing styling approach in the app).

- [ ] **Step 1: Component** — standalone, OnPush, `input.required<ItineraryStore>()` named `store`; renders `@for (g of store().days(); …)` with day headings, stop rows (place + note + ✕ remove), an add row (day number input, place text input, Add button → `store().add(...)`), and a "Reset demo data" button → `store().reset()`. Keep styles inline in the component (the demo's components do this); follow the existing `.ag-ui-demo__*` BEM naming.
- [ ] **Step 2: Layout** — in `app.html`, wrap the chat in a flex row: panel (fixed ~300px, `aria-label="Trip itinerary"`) + chat (flex-1). Stack via media query under 900px. In `app.ts`: `protected readonly itinerary = new ItineraryStore();`
- [ ] **Step 3: Verify** — `npx nx build examples-ag-ui-angular` green; `npx nx test examples-ag-ui-angular` green.
- [ ] **Step 4: Commit** — `feat(examples/ag-ui): itinerary panel beside the chat`.

---

### Task 3: Client tools + welcome chips

**Files:**
- Create: `examples/ag-ui/angular/src/app/client-tools.ts`, `clear-day-confirm.component.ts`, `day-card.component.ts`
- Modify: `app.ts` (build tools from the store; chips array + `send()`), `app.html` (`[clientTools]` on `<chat>`, chips projection)

- [ ] **Step 1: Components.**
  - `DayCardComponent` (view): inputs `day: number`, `places: string[]`; small card listing the day's places. Selector `app-day-card`.
  - `ClearDayConfirmComponent` (ask): input `day: number`; injects the host via `injectRenderHost()` from `@threadplane/render`; needs the live stop count + the actual clear — inject nothing: receive only `day`, and emit the DECISION; the store mutation happens in the tool layer? **No** — ask components emit the result value; the handler-side cannot intercept. So the component must perform the clear. Give it access to the store via a static-injected app-level provider: provide the `ItineraryStore` instance through Angular DI — in `app.config.ts` add `{ provide: ItineraryStore, useClass: ItineraryStore }` and have BOTH `app.ts` and the component `inject(ItineraryStore)`. (Adjust Task 2's `app.ts` to `inject(ItineraryStore)` instead of `new`.) Component: "Clear all {{count}} stops on day {{day}}?" with **Clear** → `store.clearDay(day)`; `host.result({ cleared: true, day, removed })` and **Cancel** → `host.result({ cleared: false, day })`. Selector `app-clear-day-confirm`.
- [ ] **Step 2: Tools registry.**

```ts
// client-tools.ts
// SPDX-License-Identifier: MIT
import { inject } from '@angular/core';
import { tools, action, view, ask, type ClientToolRegistry } from '@threadplane/chat';
import { z } from 'zod/v4';
import { ItineraryStore } from './itinerary-store';
import { DayCardComponent } from './day-card.component';
import { ClearDayConfirmComponent } from './clear-day-confirm.component';

/** Client tools over the frontend-owned itinerary. Call inside an injection
 *  context (e.g. a field initializer in App). The descriptions are the ONLY
 *  steering the model gets — no system-prompt coaching (by design). */
export function itineraryClientTools(): ClientToolRegistry {
  const store = inject(ItineraryStore);
  return tools({
    get_itinerary: action(
      "Read the user's trip itinerary: every planned stop grouped by day (with ids).",
      z.object({}),
      async () => ({ days: store.days() }),
    ),
    add_stop: action(
      'Add a stop to a day of the trip itinerary.',
      z.object({ day: z.number().int().min(1), place: z.string(), note: z.string().optional() }),
      async ({ day, place, note }) => ({ added: store.add(day, place, note) }),
    ),
    move_stop: action(
      'Move an existing stop (matched by place name) to another day.',
      z.object({ place: z.string(), toDay: z.number().int().min(1) }),
      async ({ place, toDay }) => {
        const moved = store.move(place, toDay);
        return moved ? { moved } : { error: `No stop named "${place}" — call get_itinerary to see what exists.` };
      },
    ),
    clear_day: ask(
      'Ask the user to confirm clearing every stop on a day, then clear it if they accept.',
      z.object({ day: z.number().int().min(1) }),
      ClearDayConfirmComponent,
    ),
    day_card: view(
      "Show the user a recap card for one itinerary day after you've changed it.",
      z.object({ day: z.number().int().min(1), places: z.array(z.string()) }),
      DayCardComponent,
    ),
  });
}
```

- [ ] **Step 3: Chips + wiring.** In `app.ts`:

```ts
protected readonly clientTools = itineraryClientTools();
protected readonly suggestions = [
  { label: 'Docs & citations', value: 'What do the docs say about streaming?' },
  { label: 'Generative UI', value: 'Build me a revenue dashboard' },
  { label: 'Human approval', value: 'Issue me a $50 refund' },
  { label: 'Read my itinerary', value: "What's on my itinerary?" },
  { label: 'Agent edits the page', value: 'Add the Louvre to day 2 of my trip' },
  { label: 'Consent-gated clear', value: 'Clear my day 2 plans' },
  { label: 'Research subagent', value: 'Research AG-UI and give me the highlights' },
];
protected send(value: string): void { void this.agent.submit({ message: value }); }
```

In `app.html`: `<chat main [agent]="agent" [views]="catalog" [clientTools]="clientTools" …>` and inside it project:

```html
<div chatWelcomeSuggestions>
  @for (s of suggestions; track s.value) {
    <chat-welcome-suggestion [label]="s.label" [value]="s.value" (selected)="send($event)" />
  }
</div>
```

(Import `ChatWelcomeSuggestionComponent` in `app.ts` imports. Verify the slot renders — `<chat>` projects `[chatWelcomeSuggestions]` through to `chat-welcome`; mirror `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts` if projection needs the exact wrapper.)
- [ ] **Step 4: Verify** — build + unit tests green. `git commit -m "feat(examples/ag-ui): itinerary client tools + capability suggestion chips"`.

---

### Task 4: Backend — bind the client catalog

**Files:**
- Modify: `examples/ag-ui/python/src/graph.py`, `examples/ag-ui/python/pyproject.toml`
- Regenerate: `examples/ag-ui/python/uv.lock`, `requirements.txt`

- [ ] **Step 1: Dep** — `pyproject.toml` dependencies += `"threadplane-client-tools>=0.0.1"`; from `examples/ag-ui/python`: `uv lock && uv export --no-hashes -o requirements.txt && uv sync`.
- [ ] **Step 2: State channel** — `class State(TypedDict)` gains `tools: Optional[list]` (ag-ui-langgraph merges `RunAgentInput.tools` into `state["tools"]`; the channel must exist to be retained).
- [ ] **Step 3: Bind** — in `generate`, replace `llm = ChatOpenAI(**kwargs).bind_tools([search_documents, request_approval, research, gen_ui_tool])` with:

```python
from threadplane_client_tools import bind_client_tools, client_tool_names

llm = bind_client_tools(
    ChatOpenAI(**kwargs),
    [search_documents, request_approval, research, gen_ui_tool],
    state,
)
```

- [ ] **Step 4: Routing** — `should_continue` must end the turn on pure client-tool calls (the browser executes them and re-runs):

```python
def should_continue(state: State) -> Literal["tools", "attach_citations"]:
    """Route to tools when any SERVER tool_call is present. A turn whose
    calls are all client tools must END so the browser can execute them
    and re-run with the ToolMessage; attach_citations is the terminal
    post-process (a no-op without search results)."""
    last = state["messages"][-1]
    if not (isinstance(last, AIMessage) and last.tool_calls):
        return "attach_citations"
    client = client_tool_names(state)
    if all(tc["name"] in client for tc in last.tool_calls):
        return "attach_citations"
    return "tools"
```

Mixed server+client calls keep today's `tools` route — ToolNode emits an error ToolMessage for the unknown client tool; accepted demo edge (note it in a comment).
- [ ] **Step 5: Verify** — `OPENAI_API_KEY=x uv run python -c "from src.graph import graph; print('ok')"`; existing demo e2e must still pass later (Task 5 runs the suite).
- [ ] **Step 6: Commit** — `feat(examples/ag-ui): bind the client tool catalog (threadplane-client-tools)`.

---

### Task 5: e2e — itinerary read + ask chains

**Files:**
- Create: `examples/ag-ui/angular/e2e/fixtures/itinerary.json`, `examples/ag-ui/angular/e2e/itinerary-client-tools.spec.ts`

- [ ] **Step 1: Fixtures** — read `examples/ag-ui/angular/e2e/fixtures/hi.json` and `interrupt-approval.json` FIRST and mirror the local schema exactly. Entries needed (match-block shapes as in the cockpit client-tools fixtures): for "What's on my itinerary?" → `toolCalls: [{ name: 'get_itinerary', arguments: {} }]` + a `hasToolResult: true` continuation ("You have 3 stops planned…"); for "Clear my day 2 plans" → `toolCalls: [{ name: 'clear_day', arguments: { day: 2 } }]` + continuation ("Done — day 2 is cleared.").
- [ ] **Step 2: Spec** — use the local helpers (`openDemo`, `sendPromptAndWait`/`waitForFinalAssistant`, `messageInput`, `sendButton` from `./test-helpers`):
  - read test: send "What's on my itinerary?" → expect the continuation text visible (proves the two-run client round-trip over this app).
  - ask test: send "Clear my day 2 plans" → `app-clear-day-confirm` visible with "day 2" → panel still shows the day-2 stop → click **Clear** → expect day-2 group empties in the panel AND the continuation renders.
  - panel test: `aria-label="Trip itinerary"` panel visible on load with the 3 seeded stops; clear `localStorage` in `beforeEach` via `page.addInitScript`.
- [ ] **Step 3: Run** — `npx nx e2e examples-ag-ui-angular` — new tests AND all existing specs green (the suite boots uvicorn :8000 + angular :4201 under aimock).
- [ ] **Step 4: Commit** — `test(examples/ag-ui): e2e for itinerary client tools (read + ask chains)`.

---

### Task 6: Live-LLM smoke + PR (orchestrator-run, not a subagent)

- [ ] Serve locally with the real key (backend `uv run uvicorn src.server:app --port 8000` with `OPENAI_API_KEY` from the repo root `.env`; `npx nx serve examples-ag-ui-angular --port 4201`).
- [ ] Drive ALL seven chips in Chrome; additionally exercise clear-day **Cancel** (state untouched) and a `move_stop` prompt ("Move the Louvre to day 1"). Confirm panel updates on every agent write and continuations stream after each client round-trip.
- [ ] Open PR → CI → merge on green → demo backend + "ag-ui demo → Vercel" redeploy.

## Self-review notes

- Spec coverage: store/panel (T1–2), five tools + chips (T3), backend (T4), e2e (T5), live smoke + deploy (T6) — all spec sections mapped.
- Type consistency: `ItineraryStore.days()` shape `{day, stops}[]` is what `get_itinerary` returns and the panel renders; `clear_day` result `{cleared, day, removed?}`; `ClientToolRegistry` import exists in `@threadplane/chat` public API.
- Deliberate deviation captured in-plan: `ItineraryStore` becomes a DI provider (Task 3 Step 1) because the ask component must reach the store; Task 2's `new ItineraryStore()` is adjusted accordingly.
