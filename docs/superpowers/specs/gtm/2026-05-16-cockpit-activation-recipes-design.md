---
workstream: cockpit-activation-recipes
status: approved
owner: brian
phase: 1
spec: docs/superpowers/specs/gtm/2026-05-16-cockpit-activation-recipes-design.md
plan: docs/superpowers/plans/gtm/2026-05-16-cockpit-activation-recipes.md
parent: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
---

# Spec 4 — Cockpit Activation Recipes (Design)

> Drop pre-baked "Try this prompt" suggestions onto each of the four capability examples that map to an activation signal, and tighten `ChatComponent` so `firstMessageSent` flips on any submit path. A developer landing in the cockpit now gets a 1-click path to firing each of the five activation signals.

## 1. Goal

Phase 1's activation deliverable: the developer-funnel dashboard from Spec 1A populates with real cohort data because evaluators have a frictionless way to walk through the activation funnel. Two cohesive changes:

1. **Tighten `ChatComponent`** in `@ngaf/chat` so `CHAT_LIFECYCLE.firstMessageSent` flips on the first stream-start regardless of submit path. Today the flag only flips on input-bound submits; suggestion-click handlers that call `agent.submit({message})` directly bypass the lifecycle. The fix watches `AGENT_LIFECYCLE.streamStartedAt` and flips the sticky `firstMessageSent` flag on its first transition to non-null.
2. **Add `<chat-welcome-suggestion>` rows to four cockpit capability examples** (streaming, persistence, interrupts, generative-ui) using the canonical pattern from `examples/chat/angular/src/app/modes/embed-mode.component.ts`. Each suggestion is pre-baked to drive its capability's lifecycle signal.

## 2. Context

- Parent: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` §6 (Phase 1 critical path). The meta-spec's original exit criterion for Spec 4 referenced "six activation signals" and "one comparison page successfully drives an activation." Both are revised:
  - Five signals (post-Spec 1C rename `cockpit:six_signals_complete` → `cockpit:activation_complete`).
  - Spec 3 (comparison pages) was deliberately deferred; the "driver" for activations is now the cockpit shell sidebar itself.
- The lifecycle wiring lives in `@ngaf/cockpit-telemetry` (Spec 1C) and fires on tokens from `@ngaf/chat`, `@ngaf/langgraph`, `@ngaf/render`. Spec 4 doesn't touch the telemetry library; it touches the *trigger surface* (the capability example components) and the chat composition that gates `firstMessageSent`.
- The `<chat-welcome-suggestion>` primitive already exists in `@ngaf/chat`:
  - Declaration: `libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.ts`
  - Public export: `libs/chat/src/public-api.ts` line ~75
  - Canonical usage in `examples/chat/angular/src/app/modes/embed-mode.component.ts` projects suggestions into the `[chatWelcomeSuggestions]` content slot of `<chat>`.
- The `submitMessage()` public method added to `ChatComponent` in Spec 1C Task 0.2 already routes input submits through the lifecycle. But `agent.submit({message})` — the pattern the canonical `EmbedMode` uses for suggestion clicks — bypasses it. The cleanest fix is at the lib level (see §4.1) so every consumer benefits without per-example boilerplate.

## 3. Scope

**In scope:**

- `libs/chat/src/lib/compositions/chat/chat.component.ts` — extend the existing init effect (or add a new effect alongside it) that watches `agent.lifecycle.streamStartedAt`. When it transitions from `null` to a non-null number, flip `lifecycle._internal.firstMessageSent.set(true)` — but only if it isn't already true (idempotent, sticky semantic preserved). `messageCount` and `inputSubmittedAt` are NOT touched by this path; they stay input-bound by design.
- A new unit test in `libs/chat/src/lib/lifecycle.spec.ts` (or a sibling) covering the "agent-driven submit fires firstMessageSent" case. Use the existing `mockAgent` helper from `./testing/mock-agent`.
- Per-example WELCOME_SUGGESTIONS for the four activation-signal capability examples:
  - `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts`
  - `cockpit/langgraph/persistence/angular/src/app/persistence.component.ts`
  - `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts`
  - `cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts`
- Each example mirrors the `EmbedMode` pattern: imports `ChatWelcomeSuggestionComponent`, projects suggestions through `<div chatWelcomeSuggestions>`, click handler calls `agent.submit({message: text})`.
- Each example gets a small Vitest test (or component-level Angular test) asserting that suggestion rows render with the expected labels. Tests use the existing test infrastructure under each example's `angular/` directory.
- A short README pointer (`cockpit/README.md` or a per-example doc) describing how to add more suggestions if a future capability adds an activation path. Optional polish — skip if it inflates scope.

**Out of scope:**

- aimock harness as the default backend for `cockpit:serve-<cap>`. Today the python backends require `OPENAI_API_KEY`; without it, suggestion clicks fail at the stream layer. We accept this v1: evaluators with an API key get the full path; evaluators without one still see the suggestion UI but the agent errors. A follow-up spec can wire aimock as the default.
- An "activation progress" indicator (e.g., "3/5 signals fired") in the cockpit shell. Worth doing — a follow-up spec can add it. Spec 4 stays focused on the trigger surface + the lib fix.
- A Playwright end-to-end activation suite that walks all five signals and asserts `cockpit:activation_complete` lands in PostHog. Worth doing — a follow-up spec can add it.
- New analytics events. The existing `cockpit:*` event names are unchanged.
- Updating the three existing `examples/chat/angular/src/app/modes/{embed,sidebar,popup}-mode.component.ts` files. They already use the canonical pattern; the lib fix in §4.1 makes their suggestion paths fire `firstMessageSent` automatically. No edits needed.
- The fourth capability page IS `cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts`. If the path turns out to differ (verify in implementation), the implementer adapts; spec intent is "the example that fires `cockpit:generative_component_rendered`."

**Success criteria:**

- Clicking any pre-baked suggestion in any of the four capability examples fires its corresponding activation signal (assuming a working backend).
- `CHAT_LIFECYCLE.firstMessageSent` is true after the first stream chunk, regardless of whether the submit came from the input or from `agent.submit({message})`.
- `npx nx run-many -t test -p chat,cockpit-telemetry` is green.
- The four cockpit example builds (`npx nx run cockpit-langgraph-streaming-angular:build:cockpit` etc.) succeed.
- Manual smoke: a user opening a capability in the cockpit, clicking a suggestion, and waiting for the stream sees the corresponding signal land in PostHog Live Events.

## 4. Architecture

```
User clicks <chat-welcome-suggestion>
  │  (selected) → send(text)
  ▼
example component:
  agent.submit({ message: text })
  │
  ├──▶ AGENT_LIFECYCLE.streamStartedAt flips on first chunk arrival
  │      │
  │      ├──▶ CockpitTelemetryService observes → fires cockpit:transport_connected
  │      │
  │      └──▶ ChatComponent observes (NEW in Spec 4) → flips CHAT_LIFECYCLE.firstMessageSent
  │             │
  │             └──▶ CockpitTelemetryService observes → fires cockpit:chat_first_message
  │
  ├──▶ AGENT_LIFECYCLE.threadCreatedAt (first submit) → cockpit:thread_persisted later, on reload
  ├──▶ AGENT_LIFECYCLE.interruptResolvedAt (when user resolves) → cockpit:interrupt_handled
  └──▶ RENDER_LIFECYCLE.firstMountAt (when generative UI mounts) → cockpit:generative_component_rendered
```

## 5. Components

### 5.1 `ChatComponent` enhancement

In `libs/chat/src/lib/compositions/chat/chat.component.ts`, the constructor already runs an effect that flips `componentReady` once `this.agent()` resolves. Add a parallel effect that watches the agent's `streamStartedAt`:

```typescript
// Inside the constructor (or alongside the existing init effect):
effect(() => {
  const agentRef = this.agent();
  if (!agentRef) return;
  const streamStartedAt = agentRef.lifecycle.streamStartedAt();
  if (streamStartedAt !== null && !this.lifecycle._internal.firstMessageSent()) {
    this.lifecycle._internal.firstMessageSent.set(true);
  }
});
```

Semantics:
- The signal is sticky. The if-guard prevents double-set.
- `messageCount` and `inputSubmittedAt` stay input-bound — agent-bound submits don't increment them. Rationale: those signals exist to measure UX engagement (typing, time-stamped interaction), not stream initiation. The downstream cockpit telemetry only depends on `firstMessageSent` for `cockpit:chat_first_message`, so the more selective scope is acceptable.
- The effect's auto-tracking re-runs on every signal change, but the work is constant-time and idempotent.

### 5.2 New test in `libs/chat/src/lib/lifecycle.spec.ts`

```typescript
test('firstMessageSent flips on agent-driven submit (no input call)', async () => {
  // ...standard fixture setup with mockAgent + TestBed...
  expect(lifecycle.firstMessageSent()).toBe(false);
  // Programmatic submit (bypasses chat-input)
  await chatRef.agent().submit({ message: 'hello from agent.submit' });
  // After the stream starts, firstMessageSent must be true.
  await waitForSignal(lifecycle.firstMessageSent, true);
  expect(lifecycle.firstMessageSent()).toBe(true);
});
```

The exact API (`mockAgent`, `waitForSignal` helper if it exists) follows the patterns already in `lifecycle.spec.ts`. The implementer adapts to match.

### 5.3 Per-example suggestion arrays

Each of the four example components adds a `WELCOME_SUGGESTIONS` const, imports `ChatWelcomeSuggestionComponent`, and projects suggestions into `<chat>`. Full template + content per file:

**`cockpit/langgraph/streaming/angular/src/app/streaming.component.ts`:**

```typescript
const WELCOME_SUGGESTIONS = [
  { label: 'Stream a long answer',          value: 'Explain LangGraph checkpointing in 200 words.' },
  { label: 'Walk me through agent tool calls', value: 'Show me how an agent decides which tool to use.' },
];
```

Template:
```html
<example-chat-layout>
  <chat main [agent]="agent" class="flex-1 min-w-0">
    <div chatWelcomeSuggestions>
      @for (s of suggestions; track s.value) {
        <chat-welcome-suggestion [label]="s.label" [value]="s.value" (selected)="send($event)" />
      }
    </div>
  </chat>
</example-chat-layout>
```

`send(text)`:
```typescript
protected send(text: string): void {
  void this.agent.submit({ message: text });
}
```

**`cockpit/langgraph/persistence/angular/src/app/persistence.component.ts`:**

```typescript
const WELCOME_SUGGESTIONS = [
  { label: 'Save this thread for later', value: 'Help me draft a project brief I can revisit.' },
];
```

**`cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts`:**

```typescript
const WELCOME_SUGGESTIONS = [
  { label: 'Approve a tool call', value: 'Book a flight to Paris for next Tuesday.' },
];
```

**`cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts`:**

```typescript
const WELCOME_SUGGESTIONS = [
  { label: 'Render a dashboard', value: 'Show me a Q3 sales dashboard with three metrics.' },
  { label: 'Render a form',      value: 'Create a contact form with name, email, and message.' },
];
```

Each component imports `ChatWelcomeSuggestionComponent` from `@ngaf/chat`, adds it to the `imports` array, and exposes `suggestions = WELCOME_SUGGESTIONS` as a protected readonly field.

### 5.4 Per-example tests

Each capability example adds a small Vitest test:

```typescript
// e.g., cockpit/langgraph/streaming/angular/src/app/streaming.component.spec.ts
test('renders welcome suggestion buttons', async () => {
  const fixture = TestBed.createComponent(StreamingComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const buttons = fixture.nativeElement.querySelectorAll('.chat-welcome-suggestion');
  expect(buttons.length).toBeGreaterThan(0);
  expect(buttons[0].textContent).toMatch(/Stream a long answer/);
});
```

(Spec intent — exact selector + helper may need adjusting to match existing test patterns in the same example directory.)

## 6. Data flow

For a Streaming-capability user landing fresh:

1. User opens `/langgraph/core-capabilities/streaming/...` in the cockpit.
2. `<chat>` renders the welcome state (no messages); `<chat-welcome>` slot shows the input plus two `<chat-welcome-suggestion>` rows.
3. User clicks "Stream a long answer".
4. `(selected)="send($event)"` fires with `'Explain LangGraph checkpointing in 200 words.'`.
5. `send()` calls `agent.submit({ message: text })`.
6. The agent stream starts → `AGENT_LIFECYCLE.streamStartedAt` flips non-null.
7. `CockpitTelemetryService.subscribeAgent()` effect fires `cockpit:transport_connected` and `aggregator.markSignal('transport_connected')`.
8. `ChatComponent`'s new Spec-4 effect observes the same `streamStartedAt` transition and flips `CHAT_LIFECYCLE.firstMessageSent` to true.
9. `CockpitTelemetryService.subscribeChat()` effect fires `cockpit:chat_first_message` and `aggregator.markSignal('chat_first_message')`.
10. Both signals join the 5-signal aggregator window. The user explores other capabilities; when all five fire within 30 min, `cockpit:activation_complete` fires.

## 7. Error handling

- **Suggestion click with no backend:** the agent's `submit` throws or stalls; the chat surface shows its existing error state. No special handling needed.
- **`agent.submit` errors:** captured by the existing chat error pipeline. `firstMessageSent` does not flip because `streamStartedAt` doesn't transition to non-null.
- **Empty `WELCOME_SUGGESTIONS`:** the `@for` loop renders nothing; the welcome slot is empty. Each example's array is hard-coded so this is a code-review concern, not a runtime risk.

## 8. Testing

- **Unit (jsdom, `libs/chat`):** one new lifecycle spec assertion for agent-driven submit → firstMessageSent.
- **Per-example tests:** four small assertions that suggestion buttons render.
- **Build smoke:** `nx run cockpit-langgraph-streaming-angular:build:cockpit` and the three siblings build green.
- **No new dashboard or PostHog work** — the existing developer-funnel dashboard and the activation-funnel insight already consume the same events.
- **Manual smoke** (post-merge, in production): open the cockpit on a real PostHog token; click a suggestion in each capability; verify both `cockpit:transport_connected` and `cockpit:chat_first_message` show up in Live Events with the same `cockpit_did`.

## 9. Risks

- **Backend dependency.** Capability examples require `OPENAI_API_KEY` to actually fire signals beyond `transport_connected`. Without one, the user sees the suggestion UI but the agent errors. Acceptable for v1; a follow-up spec can wire aimock as the default.
- **`firstMessageSent` flipping on stream-start, not on submit.** If an agent errors before the first chunk arrives, the signal never flips even though the user did submit. Acceptable: `cockpit:chat_first_message` is meant to mean "the user got a streaming response", which is the threshold for "they engaged with the cockpit" in PostHog terms.
- **Prompt content may not drive every signal cleanly.** "Book a flight to Paris" only triggers an interrupt if the example graph is wired for human-in-the-loop on that intent. The implementer verifies during smoke; if a prompt doesn't drive the signal, the implementer adjusts the prompt (not the graph) until it does.
- **Substring-overlap rule** (from earlier specs): no blind `replace_all`. Each example file is edited individually.

## 10. Phases

1. **Phase 0 — `ChatComponent` enhancement.** Add the agent.lifecycle.streamStartedAt watcher + new lifecycle test. (~2 commits, TDD.)
2. **Phase 1 — Streaming example.** WELCOME_SUGGESTIONS + template + test. (~1 commit.)
3. **Phase 2 — Persistence example.** Same pattern. (~1 commit.)
4. **Phase 3 — Interrupts example.** Same pattern. (~1 commit.)
5. **Phase 4 — Generative-UI example.** Same pattern. (~1 commit.)
6. **Phase 5 — Verification** (no commit). Tests + builds + brief manual sanity in the cockpit dev server.

## 11. Deliverables

- ☐ `libs/chat/src/lib/compositions/chat/chat.component.ts` — agent.lifecycle.streamStartedAt watcher added
- ☐ `libs/chat/src/lib/lifecycle.spec.ts` — new test asserts agent-driven submit flips firstMessageSent
- ☐ `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts` — WELCOME_SUGGESTIONS + `<chat-welcome-suggestion>` rows + `send()`
- ☐ `cockpit/langgraph/persistence/angular/src/app/persistence.component.ts` — same
- ☐ `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts` — same
- ☐ `cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts` — same
- ☐ Per-example component test asserts suggestion buttons render
- ☐ `nx run-many -t test -p chat,cockpit-telemetry` green
- ☐ Per-example `:build:cockpit` targets green
