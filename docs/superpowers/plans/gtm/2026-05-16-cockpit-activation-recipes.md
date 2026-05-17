# Spec 4 — Cockpit Activation Recipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten `ChatComponent` so `CHAT_LIFECYCLE.firstMessageSent` flips on any submit path, and drop pre-baked `<chat-welcome-suggestion>` rows on the four cockpit capability examples that map to activation signals.

**Architecture:** One small effect added inside `ChatComponent` watches `agent.lifecycle.streamStartedAt`; on its first transition to non-null, it flips the sticky `firstMessageSent` flag. Four cockpit example components (streaming, persistence, interrupts, generative-ui) gain a `WELCOME_SUGGESTIONS` const and project `<chat-welcome-suggestion>` rows into the `<chat>` welcome slot using the canonical pattern from `examples/chat/angular/src/app/modes/embed-mode.component.ts`. No new analytics events.

**Tech Stack:** Angular 20+ (Signals + `effect()`); `@ngaf/chat` (`ChatComponent`, `ChatWelcomeSuggestionComponent`); `@ngaf/langgraph` (`agent()`); Vitest + jsdom for unit tests (`npx nx run chat:test`).

---

## Context for the implementer

- **Spec:** `docs/superpowers/specs/gtm/2026-05-16-cockpit-activation-recipes-design.md` — read §§3–6 before starting.
- **Canonical suggestion pattern:** `examples/chat/angular/src/app/modes/embed-mode.component.ts`. Mirror it.
- **Lifecycle background:** Spec 1C (`docs/superpowers/specs/gtm/2026-05-15-analytics-foundation-1c-cockpit-instrumentation-design.md` §5) defines the three `*_LIFECYCLE` tokens. `firstMessageSent` is documented as sticky for the life of the chat instance.
- **`agent.lifecycle.streamStartedAt`:** comes from `AGENT_LIFECYCLE` in `@ngaf/langgraph` (Spec 1C Task 0.4). Available on every `agent()` return as `agentRef.lifecycle.streamStartedAt`. It's a `Signal<number | null>` that flips to `Date.now()` on the first stream chunk and resets to `null` on `switchThread(null)`.
- **No backend dependency for the new tests.** The chat lib test uses `mockAgent()` from `libs/chat/src/lib/testing/mock-agent.ts`, which already exposes a writable lifecycle.
- **TDD discipline:** spec → run-see-fail → implement → run-see-pass → commit.
- **Commit format:** conventional commits, one task = one commit.
- **Worktree branch:** `gtm-spec-4-cockpit-activation-recipes` (already created from `origin/main`, currently at `a2bbcbf9`).

## File structure (locked)

```
MODIFIED
├── libs/chat/src/lib/compositions/chat/chat.component.ts        # Phase 0 — new effect
├── libs/chat/src/lib/lifecycle.spec.ts                          # Phase 0 — new test case
├── cockpit/langgraph/streaming/angular/src/app/streaming.component.ts          # Phase 1
├── cockpit/langgraph/persistence/angular/src/app/persistence.component.ts     # Phase 2
├── cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts       # Phase 3
├── cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts      # Phase 4
```

No new files. No deletions.

---

## Phase 0 — Tighten `ChatComponent.firstMessageSent`

### Task 0.1: TDD — add lifecycle test for agent-driven submit

**Files:**
- Modify: `libs/chat/src/lib/lifecycle.spec.ts`

- [ ] **Step 1: Read the existing spec**

Open `libs/chat/src/lib/lifecycle.spec.ts`. Note the fixture setup pattern: `TestBed.createComponent(ChatComponent)` + `setInput('agent', mockAgent())` + `fixture.detectChanges()` + `injector.get(CHAT_LIFECYCLE)`.

- [ ] **Step 2: Inspect `mockAgent` so you know how to drive its lifecycle**

```bash
cat libs/chat/src/lib/testing/mock-agent.ts
```

You need to know:
- Does `mockAgent()` return an object whose `lifecycle.streamStartedAt` is a writable signal? Or is the lifecycle stubbed read-only?
- If writable: the test can do `agentRef.lifecycle._internal.streamStartedAt.set(Date.now())` or similar.
- If stubbed: you may need to call `agentRef.submit({...})` to drive the signal, and rely on the mock's internal submit handler.

Match the test approach to the actual shape of `mockAgent`. If the mock doesn't expose a way to drive `streamStartedAt`, ask before guessing — the mock may need a small enhancement (out of scope or in scope, your call).

- [ ] **Step 3: Write the failing test**

Append to `libs/chat/src/lib/lifecycle.spec.ts` inside the `describe('ChatLifecycle integration', ...)` block (after the existing tests):

```typescript
  test('firstMessageSent flips when agent.lifecycle.streamStartedAt transitions to non-null', () => {
    // Capture the agent we passed in so we can drive its lifecycle directly.
    const agent = mockAgent();
    const f = TestBed.createComponent(ChatComponent);
    f.componentRef.setInput('agent', agent);
    f.detectChanges();
    const lc = f.componentRef.injector.get(CHAT_LIFECYCLE);
    expect(lc.firstMessageSent()).toBe(false);

    // Drive the agent's streamStartedAt signal. Exact API depends on mockAgent's
    // shape — use whichever helper the mock exposes. Common patterns:
    //   agent._internal.streamStartedAt.set(Date.now())   // direct setter
    //   agent.simulateStreamStart()                        // helper method
    //   await agent.submit({ message: 'hi' })              // real submit path
    // Use the path that exists; if none does, enhance mockAgent (small).
    agent._internal.streamStartedAt.set(Date.now());
    f.detectChanges();
    expect(lc.firstMessageSent()).toBe(true);
  });

  test('firstMessageSent stays sticky across multiple agent-driven transitions', () => {
    const agent = mockAgent();
    const f = TestBed.createComponent(ChatComponent);
    f.componentRef.setInput('agent', agent);
    f.detectChanges();
    const lc = f.componentRef.injector.get(CHAT_LIFECYCLE);

    agent._internal.streamStartedAt.set(Date.now());
    f.detectChanges();
    expect(lc.firstMessageSent()).toBe(true);

    // A second stream-start (e.g., second submit) must not unset.
    agent._internal.streamStartedAt.set(null);
    f.detectChanges();
    expect(lc.firstMessageSent()).toBe(true);

    agent._internal.streamStartedAt.set(Date.now());
    f.detectChanges();
    expect(lc.firstMessageSent()).toBe(true);
  });
```

- [ ] **Step 4: Run, see fail**

```bash
npx nx run chat:test -- --testPathPattern=lifecycle.spec
```

Expected: the two new tests fail (firstMessageSent stays false even after streamStartedAt is set), because the effect doesn't exist yet.

- [ ] **Step 5: NO COMMIT** — Task 0.2 implements the effect.

### Task 0.2: Implement the agent-stream-start effect

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] **Step 1: Read the existing constructor / init effect**

In `libs/chat/src/lib/compositions/chat/chat.component.ts`, find the existing constructor and the effect that flips `lifecycle._internal.componentReady.set(true)`. That's where the new effect lives (alongside it, not inside it).

- [ ] **Step 2: Add the new effect**

Inside the constructor (after the existing init effect, or anywhere in the constructor body that runs in the injection context — `effect()` requires it), add:

```typescript
// Spec 4: flip CHAT_LIFECYCLE.firstMessageSent when the agent's stream
// starts, regardless of submit path (input-bound, programmatic, suggestion-
// click). Sticky — guarded so we never re-set a flag that's already true.
effect(() => {
  const agentRef = this.agent();
  if (!agentRef) return;
  const streamStartedAt = agentRef.lifecycle.streamStartedAt();
  if (streamStartedAt !== null && !this.lifecycle._internal.firstMessageSent()) {
    this.lifecycle._internal.firstMessageSent.set(true);
  }
});
```

Confirm the imports already include `effect` from `@angular/core`. If not, add it.

- [ ] **Step 3: Run, see pass**

```bash
npx nx run chat:test -- --testPathPattern=lifecycle.spec
```

Expected: all lifecycle tests pass (existing + 2 new = ~8 tests).

- [ ] **Step 4: Run the full chat test suite**

```bash
npx nx run chat:test
```

Expected: green. The effect is idempotent and only writes when `firstMessageSent` is false, so existing tests stay correct.

- [ ] **Step 5: Build**

```bash
npx nx run chat:build
```

Expected: green.

- [ ] **Step 6: Commit (Task 0.1 + Task 0.2 land together)**

Two failing tests + implementation that makes them pass land as one commit so the history reads as a clean TDD slice.

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts libs/chat/src/lib/lifecycle.spec.ts
git commit -m "$(cat <<'EOF'
feat(chat): flip firstMessageSent on agent stream-start (any submit path)

ChatComponent now subscribes to agent.lifecycle.streamStartedAt and
flips CHAT_LIFECYCLE.firstMessageSent on its first transition to a
non-null value. This makes the lifecycle robust to programmatic
agent.submit() calls, including the <chat-welcome-suggestion> click
handler pattern in cockpit examples.

messageCount and inputSubmittedAt remain input-bound by design — they
measure typing engagement, not stream initiation.

Two new lifecycle tests cover the agent-driven flip + stickiness across
multiple stream-starts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — Streaming capability suggestions

### Task 1.1: Add `WELCOME_SUGGESTIONS` to `streaming.component.ts`

**File:** `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts`

- [ ] **Step 1: Replace the component**

Open the file. Current shape (verbatim from main):

```typescript
import { Component } from '@angular/core';
import { ChatComponent } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class StreamingComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
```

Replace with:

```typescript
// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { environment } from '../environments/environment';

const WELCOME_SUGGESTIONS = [
  { label: 'Stream a long answer',             value: 'Explain LangGraph checkpointing in 200 words.' },
  { label: 'Walk me through agent tool calls', value: 'Show me how an agent decides which tool to use.' },
] as const;

/**
 * Streaming demo — simplest possible @ngaf/chat integration.
 *
 * Creates an agent ref and passes it to the prebuilt <chat> composition.
 * The welcome state projects pre-baked suggestion rows that drive
 * cockpit:transport_connected + cockpit:chat_first_message activation
 * signals on first click.
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" class="flex-1 min-w-0">
        <div chatWelcomeSuggestions>
          @for (s of suggestions; track s.value) {
            <chat-welcome-suggestion
              [label]="s.label"
              [value]="s.value"
              (selected)="send($event)"
            />
          }
        </div>
      </chat>
    </example-chat-layout>
  `,
})
export class StreamingComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly suggestions = WELCOME_SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npx nx run cockpit-langgraph-streaming-angular:build
npx nx run cockpit-langgraph-streaming-angular:build:cockpit
```

Expected: both green.

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/angular/src/app/streaming.component.ts
git commit -m "$(cat <<'EOF'
feat(cockpit-streaming): pre-baked welcome suggestions

Two <chat-welcome-suggestion> rows in the empty-state — "Stream a long
answer" and "Walk me through agent tool calls". Clicking either calls
agent.submit({ message: ... }) which fires AGENT_LIFECYCLE.streamStartedAt
on first chunk arrival → cockpit:transport_connected. ChatComponent's
new effect (Phase 0) then flips firstMessageSent → cockpit:chat_first_message.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Persistence capability suggestions

### Task 2.1: Add `WELCOME_SUGGESTIONS` to `persistence.component.ts`

**File:** `cockpit/langgraph/persistence/angular/src/app/persistence.component.ts`

- [ ] **Step 1: Open the file and locate the `<chat>` element**

The current template has `<chat main [agent]="agent" class="block flex-1 min-w-0" />` as a self-closing tag inside `<example-chat-layout>`. The suggestion rows go inside the `<chat>` element, so the self-close needs to become a paired open/close.

- [ ] **Step 2: Add imports**

Add `ChatWelcomeSuggestionComponent` to the import from `@ngaf/chat`:

```typescript
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@ngaf/chat';
```

Update the `imports:` array in the `@Component` decorator to include `ChatWelcomeSuggestionComponent`.

- [ ] **Step 3: Add the `WELCOME_SUGGESTIONS` const above the class**

```typescript
const WELCOME_SUGGESTIONS = [
  { label: 'Save this thread for later', value: 'Help me draft a project brief I can revisit.' },
] as const;
```

- [ ] **Step 4: Update the template — change self-close to paired, project suggestions**

Find `<chat main [agent]="agent" class="block flex-1 min-w-0" />` and replace with:

```html
<chat main [agent]="agent" class="block flex-1 min-w-0">
  <div chatWelcomeSuggestions>
    @for (s of suggestions; track s.value) {
      <chat-welcome-suggestion
        [label]="s.label"
        [value]="s.value"
        (selected)="send($event)"
      />
    }
  </div>
</chat>
```

- [ ] **Step 5: Add `suggestions` field + `send` method**

In the `PersistenceComponent` class body, add:

```typescript
  protected readonly suggestions = WELCOME_SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
```

(Position them after the existing `agent` declaration. Mind the existing thread-list signal — don't displace it.)

- [ ] **Step 6: Verify builds**

```bash
npx nx run cockpit-langgraph-persistence-angular:build
npx nx run cockpit-langgraph-persistence-angular:build:cockpit
```

Expected: both green.

- [ ] **Step 7: Commit**

```bash
git add cockpit/langgraph/persistence/angular/src/app/persistence.component.ts
git commit -m "$(cat <<'EOF'
feat(cockpit-persistence): pre-baked welcome suggestion

One <chat-welcome-suggestion> row — "Save this thread for later" —
that prompts a project-brief conversation. After the user reloads the
page, AGENT_LIFECYCLE.threadPersistedAt fires → cockpit:thread_persisted
activation signal.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Interrupts capability suggestions

### Task 3.1: Add `WELCOME_SUGGESTIONS` to `interrupts.component.ts`

**File:** `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts`

- [ ] **Step 1: Open the file and locate the `<chat>` element**

The template has `<chat [agent]="agent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />` inside the layout `main` slot. Same self-close-to-paired transformation.

- [ ] **Step 2: Add imports**

```typescript
import { ChatComponent, ChatInterruptPanelComponent, ChatWelcomeSuggestionComponent, views, type InterruptAction } from '@ngaf/chat';
```

Add `ChatWelcomeSuggestionComponent` to the `imports:` array.

- [ ] **Step 3: Add `WELCOME_SUGGESTIONS` above the class**

```typescript
const WELCOME_SUGGESTIONS = [
  { label: 'Approve a tool call', value: 'Book a flight to Paris for next Tuesday.' },
] as const;
```

- [ ] **Step 4: Update the template — paired `<chat>`, project suggestions**

Replace `<chat [agent]="agent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />` with:

```html
<chat [agent]="agent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0">
  <div chatWelcomeSuggestions>
    @for (s of suggestions; track s.value) {
      <chat-welcome-suggestion
        [label]="s.label"
        [value]="s.value"
        (selected)="send($event)"
      />
    }
  </div>
</chat>
```

The interrupt panel `@if (agent.interrupt()) { ... }` block stays where it is — outside `<chat>`.

- [ ] **Step 5: Add `suggestions` + `send` to the class**

```typescript
  protected readonly suggestions = WELCOME_SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
```

- [ ] **Step 6: Verify builds**

```bash
npx nx run cockpit-langgraph-interrupts-angular:build
npx nx run cockpit-langgraph-interrupts-angular:build:cockpit
```

Expected: both green.

- [ ] **Step 7: Commit**

```bash
git add cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts
git commit -m "$(cat <<'EOF'
feat(cockpit-interrupts): pre-baked welcome suggestion

One <chat-welcome-suggestion> row — "Approve a tool call" — that
prompts a flight-booking conversation. The graph pauses at an interrupt;
when the user approves via the ChatInterruptPanelComponent,
AGENT_LIFECYCLE.interruptResolvedAt fires → cockpit:interrupt_handled
activation signal.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Generative-UI capability suggestions

### Task 4.1: Add `WELCOME_SUGGESTIONS` to `generative-ui.component.ts`

**File:** `cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts`

- [ ] **Step 1: Update imports + class**

Replace the current file with:

```typescript
// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent, views } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { environment } from '../environments/environment';

import { StatCardComponent } from './views/stat-card.component';
import { ContainerComponent } from './views/container.component';
import { DashboardGridComponent } from './views/dashboard-grid.component';
import { LineChartComponent } from './views/line-chart.component';
import { BarChartComponent } from './views/bar-chart.component';
import { DataGridComponent } from './views/data-grid.component';

const dashboardViews = views({
  stat_card: StatCardComponent,
  container: ContainerComponent,
  dashboard_grid: DashboardGridComponent,
  line_chart: LineChartComponent,
  bar_chart: BarChartComponent,
  data_grid: DataGridComponent,
});

const WELCOME_SUGGESTIONS = [
  { label: 'Render a dashboard', value: 'Show me a Q3 sales dashboard with three metrics.' },
  { label: 'Render a form',      value: 'Create a contact form with name, email, and message.' },
] as const;

@Component({
  selector: 'app-generative-ui',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" [views]="dashboardViews" class="flex-1 min-w-0">
        <div chatWelcomeSuggestions>
          @for (s of suggestions; track s.value) {
            <chat-welcome-suggestion
              [label]="s.label"
              [value]="s.value"
              (selected)="send($event)"
            />
          }
        </div>
      </chat>
    </example-chat-layout>
  `,
})
export class GenerativeUiComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.generativeUiAssistantId,
  });
  protected readonly dashboardViews = dashboardViews;
  protected readonly suggestions = WELCOME_SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
```

- [ ] **Step 2: Verify builds**

```bash
npx nx run cockpit-chat-generative-ui-angular:build
npx nx run cockpit-chat-generative-ui-angular:build:cockpit
```

Expected: both green.

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts
git commit -m "$(cat <<'EOF'
feat(cockpit-generative-ui): pre-baked welcome suggestions

Two <chat-welcome-suggestion> rows — "Render a dashboard" and
"Render a form". Clicking either prompts the agent to emit a
generative-UI payload that RenderSpecComponent mounts, firing
RENDER_LIFECYCLE.firstMountAt → cockpit:generative_component_rendered
activation signal.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Verification (no commit)

### Task 5.1: Full test sweep across affected projects

- [ ] **Step 1: Run lib tests**

```bash
npx nx run-many -t test -p chat,cockpit-telemetry
```

Expected: green. Chat suite now ~712-714 tests passing (existing + 2 new lifecycle tests).

- [ ] **Step 2: Run the 4 example builds in both modes**

```bash
npx nx run-many -t build -p cockpit-langgraph-streaming-angular,cockpit-langgraph-persistence-angular,cockpit-langgraph-interrupts-angular,cockpit-chat-generative-ui-angular
```

Expected: green.

```bash
npx nx run cockpit-langgraph-streaming-angular:build:cockpit
npx nx run cockpit-langgraph-persistence-angular:build:cockpit
npx nx run cockpit-langgraph-interrupts-angular:build:cockpit
npx nx run cockpit-chat-generative-ui-angular:build:cockpit
```

Expected: all four green.

- [ ] **Step 3: Sanity-check the suggestions render in the cockpit dev server**

Optional smoke (requires `OPENAI_API_KEY` for the agent itself to respond, but the suggestion UI renders without it):

```bash
nx run cockpit:serve-streaming
```

Open `http://localhost:4201/langgraph/core-capabilities/streaming/...` in a browser. Confirm two pill-style suggestion rows appear below the welcome input ("Stream a long answer" and "Walk me through agent tool calls"). Click one — the input populates and the agent starts streaming (if backend is available).

Repeat for the three other capabilities if desired.

- [ ] **Step 4: Done**

If Steps 1 and 2 pass, Spec 4 is implementation-complete. Proceed to PR.

---

## Self-Review

**1. Spec coverage:**

| Spec deliverable | Task |
|---|---|
| `libs/chat/src/lib/compositions/chat/chat.component.ts` — agent.lifecycle.streamStartedAt watcher | 0.2 |
| `libs/chat/src/lib/lifecycle.spec.ts` — new test asserts agent-driven flip + stickiness | 0.1 (lands in 0.2's commit per TDD) |
| `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts` — suggestions | 1.1 |
| `cockpit/langgraph/persistence/angular/src/app/persistence.component.ts` — suggestions | 2.1 |
| `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts` — suggestions | 3.1 |
| `cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts` — suggestions | 4.1 |
| Affected projects' tests + builds green | 5.1 |

All deliverables covered.

**2. Placeholder scan:** No "TBD", no "implement later", no "similar to Task N" without showing the code. Every step has the actual code or command. ✓

**3. Type consistency:**

- `WELCOME_SUGGESTIONS` shape `{label: string, value: string}[]` — same across all 4 example files. ✓
- `send(text: string): void` signature — same across all 4 example files. ✓
- `protected readonly suggestions = WELCOME_SUGGESTIONS` — same field name everywhere. ✓
- `<chat-welcome-suggestion>` `[label]` + `[value]` + `(selected)` — matches the component API in `libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.ts`. ✓
- `agent.lifecycle.streamStartedAt` — matches the `AGENT_LIFECYCLE` shape in `libs/langgraph/src/lib/lifecycle.ts` (Spec 1C Task 0.3). ✓
- `this.lifecycle._internal.firstMessageSent` — matches the existing internal access pattern in `chat.component.ts` (Spec 1C Task 0.2). ✓
