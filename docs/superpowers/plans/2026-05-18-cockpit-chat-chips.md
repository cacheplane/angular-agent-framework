# Cockpit chat caps — welcome chips backed by aimock prompts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add welcome-suggestion chips to `c-tool-calls`, `c-subagents`, and `c-interrupts` whose `value` strings match each cap's aimock spec `PROMPT` constant exactly. Users clicking a chip get a flow guaranteed to work against the recorded fixtures.

**Architecture:** Three small Angular component edits mirroring the c-generative-ui pattern. Each adds `ChatWelcomeSuggestionComponent` import + `imports` entry, a local `SUGGESTIONS` constant, a `chatWelcomeSuggestions` slot inside the `<chat>` element, and a `send(text)` method. No new files. No backend changes. Aimock e2es continue to pass unchanged because they submit programmatically (not via chip click).

**Tech Stack:** Angular standalone components, `@ngaf/chat` (`ChatWelcomeSuggestionComponent`, `chatWelcomeSuggestions` directive), `@ngaf/langgraph` (`agent.submit({message})`).

---

## Pre-flight notes (READ FIRST)

**Working tree.** Dedicated worktree at `/tmp/chat-chips`, branch `claude/chat-chips-known-prompts` (spec already committed). Start every session with:

```bash
cd /tmp/chat-chips
pwd && git branch --show-current && git log --oneline -3
```

Expected: pwd `/tmp/chat-chips`, branch `claude/chat-chips-known-prompts`, top commit is the spec commit (e.g., `61a1cbcb`).

After any long-running step, confirm `git branch --show-current` is still `claude/chat-chips-known-prompts`. If it swaps, STOP.

**Pre-flight verified during plan-write (2026-05-18):**
- Each of the 3 target components currently uses `<chat main [agent]="agent" class="flex-1 min-w-0" />` (self-closing).
- The aimock spec PROMPT strings:
  - `cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts`: `const PROMPT = "What's the status of UA123?";`
  - `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts`: `const PROMPT = 'Plan a trip from LAX to JFK';`
  - `cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts`: `'Book me on UA123.'` and `'Book me on AA404.'` (inline, no PROMPT const).

**Hard rules.**
- One commit per code-modifying task (Tasks 1, 2, 3). Tasks 0, 4, 5 are verification-only.
- Never `git add -A` or `git add .` — stage specific paths only.
- Never push, open PR, or `--amend` (Task 6 = orchestrator).
- Never skip hooks.
- STOP and report if ANY verification step fails first-run.

**CI noise context.** Parallel domain changes may turn CI red for reasons unrelated to this PR. Local verification (Tasks 4 + 5) is the trust signal. After pushing, the orchestrator inspects any CI red to distinguish real-vs-noise.

---

## File Structure

**Modified (3 files, no new):**
- `cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts`
- `cockpit/chat/subagents/angular/src/app/subagents.component.ts`
- `cockpit/chat/interrupts/angular/src/app/interrupts.component.ts`

---

## Task 0: Pre-flight verify (no commit)

- [ ] **Step 1: Confirm each component currently uses self-closing `<chat>` tag**

```bash
grep -c '<chat main \[agent\]="agent" class="flex-1 min-w-0" />' \
  cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts \
  cockpit/chat/subagents/angular/src/app/subagents.component.ts \
  cockpit/chat/interrupts/angular/src/app/interrupts.component.ts
```

Expected: each file shows `:1` (one self-closing tag). If any shows `0`, the template structure has changed since plan-write — STOP and re-audit.

- [ ] **Step 2: Confirm aimock spec PROMPT strings match the spec doc**

```bash
grep -E "PROMPT|sendPromptAndWait" cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts | head -3
grep -E "PROMPT|sendPromptAndWait" cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts | head -3
grep -E "sendPromptAndWaitForInterrupt.*'.*'" cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts
```

Expected:
- tool-calls: `const PROMPT = "What's the status of UA123?";`
- subagents: `const PROMPT = 'Plan a trip from LAX to JFK';`
- interrupts: two lines with `'Book me on UA123.'` and `'Book me on AA404.'`

If any prompt string differs, update the corresponding chip `value` in this plan's Task N before applying.

- [ ] **Step 3: Confirm `ChatWelcomeSuggestionComponent` is exported from `@ngaf/chat`**

```bash
grep -E 'export.*ChatWelcomeSuggestionComponent|chatWelcomeSuggestions' libs/chat/src/public-api.ts | head -3
```

Expected: at least one match (the export). Used as the pattern source by c-generative-ui already.

---

## Task 1: Add chip to c-tool-calls component

**Files:**
- Modify: `cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts`

- [ ] **Step 1: Rewrite the file**

Overwrite `cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts` with the following content:

```typescript
// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import {
  ChatComponent,
  ChatToolCallsComponent,
  ChatToolCallCardComponent,
  ChatWelcomeSuggestionComponent,
} from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

const SUGGESTIONS = [
  // value matches cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts PROMPT.
  { label: 'Look up flight UA123', value: "What's the status of UA123?" },
] as const;

/**
 * ToolCallsComponent demonstrates tool calling with ChatComponent
 * and a sidebar showing ChatToolCallsComponent / ChatToolCallCardComponent.
 *
 * Welcome chip lets users one-click into the cap's recorded aimock flow.
 */
@Component({
  selector: 'app-tool-calls',
  standalone: true,
  imports: [
    ChatComponent,
    ChatToolCallsComponent,
    ChatToolCallCardComponent,
    ChatWelcomeSuggestionComponent,
    ExampleChatLayoutComponent,
  ],
  template: `
    <example-chat-layout sidebarWidth="w-80">
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
      <div sidebar class="p-4 space-y-4" style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted);">Tool Calls</h3>
        <chat-tool-calls [agent]="agent" />
        <div class="mt-4 space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--ngaf-chat-text-muted);">Available Tools</h4>
          <ul class="text-xs space-y-1 list-disc list-inside" style="color: var(--ngaf-chat-text-muted);">
            <li>search — Web search</li>
            <li>calculator — Math expressions</li>
            <li>weather — City weather</li>
          </ul>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class ToolCallsComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly suggestions = SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
```

- [ ] **Step 2: Verify file parses + diff is the expected shape**

```bash
npx tsc --noEmit cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts --skipLibCheck 2>&1 | tail -5
```

Expected: no errors (or only the same warnings TS would report on the unchanged file).

```bash
git diff cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts | head -40
```

Expected: diff shows the SUGGESTIONS const added, ChatWelcomeSuggestionComponent imported, `<chat>` opening tag (no longer self-closing) + chatWelcomeSuggestions block + closing `</chat>`, and the new `suggestions` field + `send()` method.

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts
git commit -m "$(cat <<'EOF'
feat(c-tool-calls): add welcome chip for recorded aimock prompt

Adds one chat-welcome-suggestion whose value exactly matches the PROMPT
in cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts. Users
clicking the chip drive a flow guaranteed to replay from the recorded
fixture (no real OpenAI hit).

Closes one row of the chip-vs-test drift surfaced by the suggested-
prompts audit (task #1 of the post-migration follow-up queue).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add chip to c-subagents component

**Files:**
- Modify: `cockpit/chat/subagents/angular/src/app/subagents.component.ts`

- [ ] **Step 1: Rewrite the file**

Overwrite `cockpit/chat/subagents/angular/src/app/subagents.component.ts` with:

```typescript
// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import {
  ChatComponent,
  ChatSubagentsComponent,
  ChatSubagentCardComponent,
  ChatWelcomeSuggestionComponent,
} from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

const SUGGESTIONS = [
  // value matches cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts PROMPT.
  { label: 'Plan a trip', value: 'Plan a trip from LAX to JFK' },
] as const;

/**
 * SubagentsComponent demonstrates subagent orchestration with
 * ChatComponent and a sidebar showing ChatSubagentsComponent /
 * ChatSubagentCardComponent for tracking active subagents.
 *
 * Welcome chip lets users one-click into the cap's recorded aimock flow.
 */
@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [
    ChatComponent,
    ChatSubagentsComponent,
    ChatSubagentCardComponent,
    ChatWelcomeSuggestionComponent,
    ExampleChatLayoutComponent,
  ],
  template: `
    <example-chat-layout sidebarWidth="w-80">
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
      <div sidebar class="p-4 space-y-4" style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted);">Active Subagents</h3>
        <chat-subagents [agent]="agent" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--ngaf-chat-text-muted);">Agent Pipeline</h4>
          <ol class="text-xs space-y-1 list-decimal list-inside" style="color: var(--ngaf-chat-text-muted);">
            <li>Orchestrator</li>
            <li>Research Agent</li>
            <li>Analysis Agent</li>
            <li>Summary Agent</li>
          </ol>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class SubagentsComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly suggestions = SUGGESTIONS;

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit cockpit/chat/subagents/angular/src/app/subagents.component.ts --skipLibCheck 2>&1 | tail -5
git diff cockpit/chat/subagents/angular/src/app/subagents.component.ts | head -40
```

Expected: tsc clean; diff shows SUGGESTIONS + import + `<chat>` wrap + `send()` method.

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/subagents/angular/src/app/subagents.component.ts
git commit -m "$(cat <<'EOF'
feat(c-subagents): add welcome chip for recorded aimock prompt

Adds one chat-welcome-suggestion whose value exactly matches the PROMPT
in cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts (`Plan a trip
from LAX to JFK`). Users clicking the chip drive the recorded orchestrator
→ research/booking/itinerary subagent flow with no real OpenAI hit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add chips to c-interrupts component (2 chips, one per flow)

**Files:**
- Modify: `cockpit/chat/interrupts/angular/src/app/interrupts.component.ts`

- [ ] **Step 1: Rewrite the file**

Overwrite `cockpit/chat/interrupts/angular/src/app/interrupts.component.ts` with:

```typescript
// SPDX-License-Identifier: MIT
import { Component, computed } from '@angular/core';
import { JsonPipe } from '@angular/common';
import {
  ChatComponent,
  ChatInterruptPanelComponent,
  ChatWelcomeSuggestionComponent,
} from '@ngaf/chat';
import type { InterruptAction } from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

const SUGGESTIONS = [
  // values match cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts.
  // Confirm flow: book + Accept → "Booked …"
  { label: 'Book UA123 (confirm)', value: 'Book me on UA123.' },
  // Cancel flow: book + Ignore → "Booking cancelled."
  { label: 'Book AA404 (cancel)', value: 'Book me on AA404.' },
] as const;

/**
 * InterruptsComponent demonstrates human-in-the-loop approval gates
 * using ChatComponent and ChatInterruptPanelComponent.
 *
 * Shows interrupt payload and action buttons in a sidebar panel.
 * Maps the panel's UI actions to LangGraph resume payloads:
 *   Accept  → resume('confirm')   — the book_flight tool returns Booked …
 *   Ignore  → resume('cancel')    — the book_flight tool returns Booking cancelled.
 * Edit / Respond are not wired for this demo's single-decision booking flow.
 *
 * Welcome chips let users one-click into either recorded aimock flow.
 * Chip labels hint at the modal action that produces the recorded path.
 */
@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [
    ChatComponent,
    ChatInterruptPanelComponent,
    ChatWelcomeSuggestionComponent,
    JsonPipe,
    ExampleChatLayoutComponent,
  ],
  template: `
    <example-chat-layout sidebarWidth="w-80">
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
      <div sidebar class="p-4 space-y-4" style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted);">Interrupt Panel</h3>
        <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--ngaf-chat-text-muted);">Stream Status</h4>
          <p class="text-xs font-mono" style="color: var(--ngaf-chat-text-muted);">{{ streamStatus() }}</p>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class InterruptsComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly streamStatus = computed(() => this.agent.status());
  protected readonly suggestions = SUGGESTIONS;

  protected onInterruptAction(action: InterruptAction): void {
    if (action === 'accept') {
      this.agent.submit({ resume: 'confirm' });
    } else if (action === 'ignore') {
      this.agent.submit({ resume: 'cancel' });
    }
    // 'edit' and 'respond' are intentionally unhandled for the booking flow.
  }

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit cockpit/chat/interrupts/angular/src/app/interrupts.component.ts --skipLibCheck 2>&1 | tail -5
git diff cockpit/chat/interrupts/angular/src/app/interrupts.component.ts | head -50
```

Expected: tsc clean; diff shows the 2-chip SUGGESTIONS, ChatWelcomeSuggestionComponent import, `<chat>` wrap, new `suggestions` field + `send()` method. The existing `onInterruptAction` is preserved.

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/interrupts/angular/src/app/interrupts.component.ts
git commit -m "$(cat <<'EOF'
feat(c-interrupts): add welcome chips for both recorded aimock flows

Two chat-welcome-suggestions, one per recorded flow:
- "Book UA123 (confirm)" → matches the spec's confirm-flow PROMPT.
- "Book AA404 (cancel)" → matches the spec's cancel-flow PROMPT.

Labels hint at the modal action (Accept vs Ignore) that produces the
recorded resume path. Users clicking either chip drive a flow guaranteed
to replay from the recorded fixture.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Build verification (no commit)

Confirms tsc + Angular compilation are clean for all 3 modified projects.

- [ ] **Step 1: Build each project**

```bash
npx nx build cockpit-chat-tool-calls-angular --skip-nx-cache 2>&1 | tail -3
npx nx build cockpit-chat-subagents-angular --skip-nx-cache 2>&1 | tail -3
npx nx build cockpit-chat-interrupts-angular --skip-nx-cache 2>&1 | tail -3
```

Expected: each ends with `Successfully ran target build for project <name>`. Any failure (import error, template error, type mismatch) STOPs.

---

## Task 5: E2e regression (no commit)

The 4 existing aimock e2es should all still pass — chip additions are pure UI surface; tests submit via `sendPromptAndWait` / `sendPromptAndWaitForInterrupt` (textarea + Send button), not via chip click.

- [ ] **Step 1: Run the 4 cockpit aimock e2es sequentially**

```bash
npx nx e2e cockpit-langgraph-streaming-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-tool-calls-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-interrupts-angular --skip-nx-cache
```

Expected: all four pass. Combined runtime ~5-7 minutes.

If any fail, STOP. Most likely cause would be the `<chat>` wrap accidentally breaking something the test depended on. Inspect the failing test's locator + screenshot to diagnose.

---

## Task 6: Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 5.

- [ ] **Step 1: Push**

```bash
git push -u origin claude/chat-chips-known-prompts
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --head claude/chat-chips-known-prompts --title "feat(cockpit-chat): welcome chips backed by recorded aimock prompts (c-tool-calls, c-subagents, c-interrupts)" --body "$(cat <<'EOF'
## Summary
Audit deliverable for task #1 of the post-migration follow-up queue. Adds welcome-suggestion chips to 3 cockpit chat caps whose aimock specs already exercise specific prompts but whose UIs surface nothing to first-time users. Each chip's \`value\` matches the corresponding aimock spec \`PROMPT\` constant byte-for-byte, so clicking a chip drives a flow guaranteed to replay from the recorded fixture (no real OpenAI hit).

| Cap | Chip(s) added | Matches spec |
|---|---|---|
| c-tool-calls | "Look up flight UA123" → \`What's the status of UA123?\` | c-tool-calls.spec.ts \`PROMPT\` |
| c-subagents | "Plan a trip" → \`Plan a trip from LAX to JFK\` | c-subagents.spec.ts \`PROMPT\` |
| c-interrupts | "Book UA123 (confirm)" → \`Book me on UA123.\`<br>"Book AA404 (cancel)" → \`Book me on AA404.\` | c-interrupts.spec.ts (2 inline prompts) |

Pattern mirrors c-generative-ui's existing chip wiring (which itself has 2 chips). Other 7 chat caps (messages, input, debug, theming, threads, timeline, a2ui) don't have aimock specs yet — chips deferred until aimock specs land (task #4 in the queue).

## Test plan
- [x] \`nx build\` succeeds for cockpit-chat-tool-calls-angular, cockpit-chat-subagents-angular, cockpit-chat-interrupts-angular
- [x] \`nx e2e cockpit-langgraph-streaming-angular\` passes (regression)
- [x] \`nx e2e cockpit-chat-tool-calls-angular\` passes (chip add is pure UI)
- [x] \`nx e2e cockpit-chat-subagents-angular\` passes
- [x] \`nx e2e cockpit-chat-interrupts-angular\` passes
- [ ] CI Cockpit gates green

## CI note
Parallel domain changes may be in flight that turn unrelated CI jobs red. The local 4× e2e suite passed; relevant Cockpit jobs are the real gate.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks <PR#>
```

The 3 relevant Cockpit gates (Cockpit — e2e, Cockpit — build / test, Cockpit — build all examples) should run because the diff touches cockpit/chat/*/angular/ paths.

If unrelated jobs fail (Website, Library, etc.), inspect the failure log + main's status to determine if it's the "domain churn" the user warned about. Otherwise treat any Cockpit job failure as a real signal — STOP and report.

- [ ] **Step 4: Merge when Cockpit gates pass**

```bash
gh pr merge <PR#> --squash --delete-branch
```

- [ ] **Step 5: Clean up worktree**

```bash
cd /Users/blove/repos/angular-agent-framework
git worktree remove --force /tmp/chat-chips
git worktree list | head -3
```

---

## Self-review notes

**Spec coverage:**
- Three component edits → Tasks 1, 2, 3.
- `nx build` verification → Task 4.
- Existing aimock e2es still pass → Task 5.
- Chip `value` matches PROMPT byte-for-byte → confirmed via Task 0 Step 2 + each task's exact-string commit code.

**Placeholder scan:** none. Every step has either exact code or an exact command + expected output.

**Type consistency:**
- `SUGGESTIONS` array shape `{ label, value }` consistent across all 3 components.
- `send(text: string): void` method signature consistent.
- `protected readonly suggestions = SUGGESTIONS;` field consistent.
- `ChatWelcomeSuggestionComponent` imported and added to `imports` in all 3.
- The `<chat>` element wraps `<div chatWelcomeSuggestions>` with `@for` over `suggestions` consistently.

**Concurrency note:** dedicated worktree at `/tmp/chat-chips` insulates from shared-checkout chaos. Each task's first action is `cd /tmp/chat-chips` + branch confirm.
