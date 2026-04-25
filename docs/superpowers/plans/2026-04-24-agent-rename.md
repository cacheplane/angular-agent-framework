# Rename `ChatAgent` → `Agent` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the runtime-neutral contract in `@cacheplane/chat` from `ChatAgent` / `ChatAgentWithHistory` and the paired data/factory/test types per the rename map in the spec, with no backwards-compat aliases.

**Architecture:** Mechanical rename. `git mv` files to preserve history, then find/replace symbol names across the codebase. No structural changes; the type fields, signal shapes, and adapter behavior are unchanged.

**Tech Stack:** Angular 21 (signals), RxJS, Nx, Vitest, ng-packagr.

**Spec:** `docs/superpowers/specs/2026-04-24-agent-rename-design.md`

---

## Rename map (canonical reference)

### Type renames

```
ChatAgent                          → Agent
ChatAgentWithHistory               → AgentWithHistory
ChatMessage                        → Message
ChatRole                           → Role
ChatToolCall                       → ToolCall
ChatToolCallStatus                 → ToolCallStatus
ChatContentBlock                   → ContentBlock
ChatSubagent                       → Subagent
ChatSubagentStatus                 → SubagentStatus
ChatStatus                         → AgentStatus
ChatInterrupt                      → AgentInterrupt
ChatCustomEvent                    → AgentCustomEvent
ChatSubmitInput                    → AgentSubmitInput
ChatSubmitOptions                  → AgentSubmitOptions
ChatCheckpoint                     → AgentCheckpoint
MockChatAgent                      → MockAgent
MockChatAgentOptions               → MockAgentOptions
```

### Function renames

```
toChatAgent                            → toAgent
mockChatAgent                          → mockAgent
runChatAgentConformance                → runAgentConformance
runChatAgentWithHistoryConformance     → runAgentWithHistoryConformance
```

### File renames (`git mv` preserves history)

```
libs/chat/src/lib/agent/chat-agent.ts                            → agent.ts
libs/chat/src/lib/agent/chat-agent.spec.ts                       → agent.spec.ts
libs/chat/src/lib/agent/chat-agent-with-history.ts               → agent-with-history.ts
libs/chat/src/lib/agent/chat-message.ts                          → message.ts
libs/chat/src/lib/agent/chat-message.spec.ts                     → message.spec.ts
libs/chat/src/lib/agent/chat-content-block.ts                    → content-block.ts
libs/chat/src/lib/agent/chat-tool-call.ts                        → tool-call.ts
libs/chat/src/lib/agent/chat-subagent.ts                         → subagent.ts
libs/chat/src/lib/agent/chat-status.ts                           → agent-status.ts
libs/chat/src/lib/agent/chat-interrupt.ts                        → agent-interrupt.ts
libs/chat/src/lib/agent/chat-submit.ts                           → agent-submit.ts
libs/chat/src/lib/agent/chat-custom-event.ts                     → agent-custom-event.ts
libs/chat/src/lib/agent/chat-custom-event.spec.ts                → agent-custom-event.spec.ts
libs/chat/src/lib/agent/chat-checkpoint.ts                       → agent-checkpoint.ts

libs/chat/src/lib/testing/mock-chat-agent.ts                     → mock-agent.ts
libs/chat/src/lib/testing/mock-chat-agent.spec.ts                → mock-agent.spec.ts
libs/chat/src/lib/testing/chat-agent-conformance.ts              → agent-conformance.ts
libs/chat/src/lib/testing/chat-agent-conformance.spec.ts         → agent-conformance.spec.ts
libs/chat/src/lib/testing/chat-agent-with-history-conformance.ts → agent-with-history-conformance.ts

libs/langgraph/src/lib/to-chat-agent.ts                          → to-agent.ts
libs/langgraph/src/lib/to-chat-agent.spec.ts                     → to-agent.spec.ts
libs/langgraph/src/lib/to-chat-agent.conformance.spec.ts         → to-agent.conformance.spec.ts
```

---

## File Structure (no new files; only renames + edits)

This plan creates no new source files. All work is rename + find/replace.

---

### Task 1: Rename core agent files in `libs/chat/src/lib/agent/`

**Files:** all under `libs/chat/src/lib/agent/`.

- [ ] **Step 1: `git mv` each file**

```bash
cd libs/chat/src/lib/agent
git mv chat-agent.ts agent.ts
git mv chat-agent.spec.ts agent.spec.ts
git mv chat-agent-with-history.ts agent-with-history.ts
git mv chat-message.ts message.ts
git mv chat-message.spec.ts message.spec.ts
git mv chat-content-block.ts content-block.ts
git mv chat-tool-call.ts tool-call.ts
git mv chat-subagent.ts subagent.ts
git mv chat-status.ts agent-status.ts
git mv chat-interrupt.ts agent-interrupt.ts
git mv chat-submit.ts agent-submit.ts
git mv chat-custom-event.ts agent-custom-event.ts
git mv chat-custom-event.spec.ts agent-custom-event.spec.ts
git mv chat-checkpoint.ts agent-checkpoint.ts
cd ../../../../..
```

- [ ] **Step 2: Update each file's symbol declarations and internal imports**

For every renamed file, apply find/replace based on the rename map. For example, in `agent.ts`:
- Replace `ChatAgent` with `Agent`
- Replace `ChatMessage` with `Message`
- Replace `ChatToolCall` with `ToolCall`
- Replace `ChatStatus` with `AgentStatus`
- Replace `ChatInterrupt` with `AgentInterrupt`
- Replace `ChatSubagent` with `Subagent`
- Replace `ChatCustomEvent` with `AgentCustomEvent`
- Replace `ChatSubmitInput` with `AgentSubmitInput`
- Replace `ChatSubmitOptions` with `AgentSubmitOptions`
- Update `from './chat-message'` → `from './message'` (and similar for every renamed sibling)

After this step `libs/chat/src/lib/agent/agent.ts` should look like:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Message } from './message';
import type { ToolCall } from './tool-call';
import type { AgentStatus } from './agent-status';
import type { AgentInterrupt } from './agent-interrupt';
import type { Subagent } from './subagent';
import type { AgentCustomEvent } from './agent-custom-event';
import type { AgentSubmitInput, AgentSubmitOptions } from './agent-submit';

export interface Agent {
  messages:  Signal<Message[]>;
  status:    Signal<AgentStatus>;
  isLoading: Signal<boolean>;
  error:     Signal<unknown>;
  toolCalls: Signal<ToolCall[]>;
  state:     Signal<Record<string, unknown>>;
  submit: (input: AgentSubmitInput, opts?: AgentSubmitOptions) => Promise<void>;
  stop:   () => Promise<void>;
  interrupt?:     Signal<AgentInterrupt | undefined>;
  subagents?:     Signal<Map<string, Subagent>>;
  customEvents$?: Observable<AgentCustomEvent>;
}
```

`agent-with-history.ts`:
```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { Agent } from './agent';
import type { AgentCheckpoint } from './agent-checkpoint';

export interface AgentWithHistory extends Agent {
  history: Signal<AgentCheckpoint[]>;
}
```

`message.ts`: declares `Message` and `Role` (not `ChatMessage` / `ChatRole`); update guard helpers (`isUserMessage`, etc.) to take `Message`.

Apply the same find/replace to every file in the directory.

- [ ] **Step 3: Verify the directory builds in isolation**

Skip — internal references won't resolve until index.ts and consumers update. Move to Task 2.

---

### Task 2: Rename testing files in `libs/chat/src/lib/testing/`

- [ ] **Step 1: `git mv` each file**

```bash
cd libs/chat/src/lib/testing
git mv mock-chat-agent.ts mock-agent.ts
git mv mock-chat-agent.spec.ts mock-agent.spec.ts
git mv chat-agent-conformance.ts agent-conformance.ts
git mv chat-agent-conformance.spec.ts agent-conformance.spec.ts
git mv chat-agent-with-history-conformance.ts agent-with-history-conformance.ts
cd ../../../../..
```

- [ ] **Step 2: Update each file's symbols and imports**

In `mock-agent.ts`:
- `mockChatAgent` → `mockAgent`
- `MockChatAgent` → `MockAgent`
- `MockChatAgentOptions` → `MockAgentOptions`
- `ChatAgent` → `Agent`, `ChatMessage` → `Message`, `ChatStatus` → `AgentStatus`, etc. per rename map
- Update `from '../agent'` import block to use new type names

In `agent-conformance.ts`: `runChatAgentConformance` → `runAgentConformance`; update `ChatAgent` → `Agent`.

In `agent-with-history-conformance.ts`: `runChatAgentWithHistoryConformance` → `runAgentWithHistoryConformance`; `ChatAgentWithHistory` → `AgentWithHistory`; `ChatCheckpoint` → `AgentCheckpoint`. Also update internal call: `runChatAgentConformance(label, ...)` → `runAgentConformance(label, ...)` and the `import` statement: `from './chat-agent-conformance'` → `from './agent-conformance'`.

Spec files: rename `describe('mockChatAgent ...')` strings to `describe('mockAgent ...')`. Same for the other spec.

---

### Task 3: Update `libs/chat/src/lib/agent/index.ts`

- [ ] **Step 1: Replace re-exports**

Final content of `libs/chat/src/lib/agent/index.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export type { Agent } from './agent';
export type { Message, Role } from './message';
export { isUserMessage, isAssistantMessage, isToolMessage, isSystemMessage } from './message';
export type { ContentBlock } from './content-block';
export type { ToolCall, ToolCallStatus } from './tool-call';
export type { AgentStatus } from './agent-status';
export type { AgentInterrupt } from './agent-interrupt';
export type { Subagent, SubagentStatus } from './subagent';
export type { AgentSubmitInput, AgentSubmitOptions } from './agent-submit';
export type { AgentCustomEvent } from './agent-custom-event';
export type { AgentCheckpoint } from './agent-checkpoint';
export type { AgentWithHistory } from './agent-with-history';
```

---

### Task 4: Update `libs/chat/src/public-api.ts`

- [ ] **Step 1: Update the agent exports block**

Replace the entire `export type { ... } from './lib/agent'` block with:

```ts
export type {
  Agent,
  AgentWithHistory,
  Message,
  Role,
  ContentBlock,
  ToolCall,
  ToolCallStatus,
  AgentStatus,
  AgentInterrupt,
  Subagent,
  SubagentStatus,
  AgentSubmitInput,
  AgentSubmitOptions,
  AgentCustomEvent,
  AgentCheckpoint,
} from './lib/agent';
export {
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
  isSystemMessage,
} from './lib/agent';
```

- [ ] **Step 2: Update the testing exports block**

Replace the existing `mockChatAgent` / `MockChatAgent` / `MockChatAgentOptions` / `runChatAgentConformance` / `runChatAgentWithHistoryConformance` entries with their new names. Final testing block:

```ts
export { mockAgent } from './lib/testing/mock-agent';
export type { MockAgent, MockAgentOptions } from './lib/testing/mock-agent';
export { runAgentConformance } from './lib/testing/agent-conformance';
export { runAgentWithHistoryConformance } from './lib/testing/agent-with-history-conformance';
```

- [ ] **Step 3: Run chat lint + test + build (will fail; that's fine)**

```bash
npx nx run-many -t lint,test,build -p chat
```

Expected: FAIL — chat primitives still reference old names. Move to Task 5.

---

### Task 5: Update chat primitives + compositions

**Files:** every `.ts` and `.spec.ts` under `libs/chat/src/lib/primitives/**` and `libs/chat/src/lib/compositions/**` that imports `ChatAgent` / `ChatMessage` / etc. or calls `mockChatAgent` / `runChatAgentConformance` / `runChatAgentWithHistoryConformance`.

- [ ] **Step 1: Find affected files**

```bash
rg -l "\bChatAgent\b|\bChatAgentWithHistory\b|\bChatMessage\b|\bChatRole\b|\bChatToolCall\b|\bChatToolCallStatus\b|\bChatContentBlock\b|\bChatSubagent\b|\bChatSubagentStatus\b|\bChatStatus\b|\bChatInterrupt\b|\bChatCustomEvent\b|\bChatSubmitInput\b|\bChatSubmitOptions\b|\bChatCheckpoint\b|\bmockChatAgent\b|\bMockChatAgent\b|\bMockChatAgentOptions\b|\brunChatAgentConformance\b|\brunChatAgentWithHistoryConformance\b" libs/chat/src/lib/primitives/ libs/chat/src/lib/compositions/
```

- [ ] **Step 2: Apply the rename map across each file**

For each file, run find/replace using the canonical rename map at the top of this plan. Whole-word boundaries are essential — `ChatAgent` should not match `ChatAgentWithHistory` in a partial way (it doesn't; `replace_all` on the longer string first, or use whole-word regex).

Order to avoid partial matches:
1. `ChatAgentWithHistory` → `AgentWithHistory` (longest first)
2. `ChatAgent` → `Agent`
3. `MockChatAgentOptions` → `MockAgentOptions`
4. `MockChatAgent` → `MockAgent`
5. `mockChatAgent` → `mockAgent`
6. `runChatAgentWithHistoryConformance` → `runAgentWithHistoryConformance`
7. `runChatAgentConformance` → `runAgentConformance`
8. `toChatAgent` → `toAgent`
9. `ChatMessage` → `Message`
10. `ChatRole` → `Role`
11. `ChatToolCallStatus` → `ToolCallStatus`
12. `ChatToolCall` → `ToolCall`
13. `ChatContentBlock` → `ContentBlock`
14. `ChatSubagentStatus` → `SubagentStatus`
15. `ChatSubagent` → `Subagent`
16. `ChatStatus` → `AgentStatus`
17. `ChatInterrupt` → `AgentInterrupt`
18. `ChatCustomEvent` → `AgentCustomEvent`
19. `ChatSubmitInput` → `AgentSubmitInput`
20. `ChatSubmitOptions` → `AgentSubmitOptions`
21. `ChatCheckpoint` → `AgentCheckpoint`

Also update import paths if any file directly imports from `./agent/chat-agent`, `./agent/chat-message`, etc. (most use the `'../agent'` barrel; those need no path edits).

- [ ] **Step 3: Run chat lint + test + build**

```bash
npx nx run-many -t lint,test,build -p chat
```

Expected: PASS. If any errors remain, they should be missed find/replace targets — fix and re-run.

- [ ] **Step 4: Commit (intermediate checkpoint)**

```bash
git add libs/chat/
git commit -m "refactor(chat): rename ChatAgent → Agent and paired types"
```

---

### Task 6: Rename `to-chat-agent` files in `libs/langgraph/`

**Files:**
- Rename: `libs/langgraph/src/lib/to-chat-agent.ts` → `to-agent.ts`
- Rename: `libs/langgraph/src/lib/to-chat-agent.spec.ts` → `to-agent.spec.ts`
- Rename: `libs/langgraph/src/lib/to-chat-agent.conformance.spec.ts` → `to-agent.conformance.spec.ts`
- Modify: `libs/langgraph/src/public-api.ts`

- [ ] **Step 1: `git mv` files**

```bash
cd libs/langgraph/src/lib
git mv to-chat-agent.ts to-agent.ts
git mv to-chat-agent.spec.ts to-agent.spec.ts
git mv to-chat-agent.conformance.spec.ts to-agent.conformance.spec.ts
cd ../../../..
```

- [ ] **Step 2: Update each file's symbols and imports**

In `to-agent.ts`:
- Function name: `toChatAgent` → `toAgent`
- Return type: `ChatAgentWithHistory` → `AgentWithHistory`
- Translation helpers: anywhere `ChatMessage` / `ChatToolCall` / `ChatStatus` / `ChatInterrupt` / `ChatSubagent` / `ChatCustomEvent` / `ChatSubmitInput` / `ChatSubmitOptions` / `ChatCheckpoint` / `ChatRole` / `ChatToolCallStatus` appears, apply rename map.
- Imports from `@cacheplane/chat`: update the type names (the package name stays).

In both spec files:
- Imports: `toChatAgent` → `toAgent`; types per rename map.
- Function calls: `runChatAgentConformance` → `runAgentConformance`; `runChatAgentWithHistoryConformance` → `runAgentWithHistoryConformance`.
- Stub helpers (`stubAgentRef`, `minimalRef`): no name changes needed (these don't use `Chat*` prefix).

- [ ] **Step 3: Update `libs/langgraph/src/public-api.ts`**

Find the line:
```ts
export { toChatAgent } from './lib/to-chat-agent';
```

Replace with:
```ts
export { toAgent } from './lib/to-agent';
```

- [ ] **Step 4: Run langgraph lint + test + build**

```bash
npx nx run-many -t lint,test,build -p langgraph
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/
git commit -m "refactor(langgraph): rename toChatAgent → toAgent"
```

---

### Task 7: Update cockpit consumers

**Files:** every `.ts` under `cockpit/` that imports from `@cacheplane/chat` or `@cacheplane/langgraph` and references `toChatAgent`, `mockChatAgent`, `ChatAgent` types, or any of the other renamed symbols.

- [ ] **Step 1: Find affected files**

```bash
rg -l "\bChatAgent\b|\bChatAgentWithHistory\b|\bChatMessage\b|\bChatRole\b|\bChatToolCall\b|\bChatToolCallStatus\b|\bChatContentBlock\b|\bChatSubagent\b|\bChatSubagentStatus\b|\bChatStatus\b|\bChatInterrupt\b|\bChatCustomEvent\b|\bChatSubmitInput\b|\bChatSubmitOptions\b|\bChatCheckpoint\b|\bmockChatAgent\b|\bMockChatAgent\b|\bMockChatAgentOptions\b|\brunChatAgentConformance\b|\brunChatAgentWithHistoryConformance\b|\btoChatAgent\b" cockpit/
```

- [ ] **Step 2: Apply rename map to each file**

Same ordered find/replace as Task 5 Step 2.

The most common pattern in cockpit demos:
- `import { toChatAgent } from '@cacheplane/langgraph';` → `import { toAgent } from '@cacheplane/langgraph';`
- `protected readonly chatAgent = toChatAgent(this.stream);` → `protected readonly chatAgent = toAgent(this.stream);` (variable name stays — it's local).

You MAY rename the local variable `chatAgent` → `agent` in cockpit files for consistency with the new vocabulary, but it's optional and a personal-style call. If you do, also update template references (`[agent]="chatAgent"` → `[agent]="agent"`).

- [ ] **Step 3: Build all affected cockpit apps**

```bash
npx nx affected -t build --base=origin/main
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add cockpit/
git commit -m "refactor(cockpit): adopt Agent rename across demos"
```

---

### Task 8: Final verification, push, PR

- [ ] **Step 1: Verify no stale references remain**

```bash
rg "\bChatAgent\b|\bChatAgentWithHistory\b|\btoChatAgent\b|\bmockChatAgent\b|\bMockChatAgent\b|\bMockChatAgentOptions\b|\brunChatAgentConformance\b|\brunChatAgentWithHistoryConformance\b" libs/ cockpit/
```

Expected: zero hits in source files (`docs/superpowers/specs/2026-04-21-*` and `docs/superpowers/plans/2026-04-21-*` are intentionally NOT renamed — they're historical).

```bash
rg "\bChatMessage\b|\bChatRole\b|\bChatToolCall\b|\bChatContentBlock\b|\bChatSubagent\b|\bChatStatus\b|\bChatInterrupt\b|\bChatCustomEvent\b|\bChatSubmit(Input|Options)\b|\bChatCheckpoint\b" libs/ cockpit/
```

Expected: zero hits.

- [ ] **Step 2: Full lint/test/build**

```bash
npx nx run-many -t lint,test,build -p chat,langgraph
npx nx affected -t build --base=origin/main
```

Expected: all pass.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/rename-chat-agent-to-agent
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "refactor: rename ChatAgent → Agent across the contract surface" --body "$(cat <<'EOF'
## Summary
- Renames `ChatAgent` / `ChatAgentWithHistory` to `Agent` / `AgentWithHistory`.
- Strips `Chat` prefix from message/data types: `Message`, `Role`, `ToolCall`, `ContentBlock`, `Subagent`.
- Prefixes `Agent` on names that would collide otherwise: `AgentCustomEvent` (vs DOM), `AgentInterrupt` / `AgentCheckpoint` (vs `@langchain/langgraph-sdk`), `AgentStatus` (clarity), `AgentSubmitInput` / `AgentSubmitOptions` (clarity).
- Renames `toChatAgent` → `toAgent`, `mockChatAgent` → `mockAgent`, conformance helpers analogously.
- File renames via `git mv` so blame/log preserve.
- No backwards-compat aliases — fresh names only.

## Motivation
Naming clarity. The contract is agent-general; the `Chat` prefix obscured this and misaligned with industry vocabulary (OpenAI Agents SDK, AG-UI, Mastra, CrewAI, Pydantic AI all use `Agent`).

## Test Plan
- [x] `nx run-many -t lint,test,build -p chat,langgraph` passes
- [x] `nx affected -t build` passes
- [x] No residual `ChatAgent` / `ChatMessage` / etc. references in `libs/` or `cockpit/`
- [ ] Cockpit demos render correctly in browser

## Design + plan
- Spec: `docs/superpowers/specs/2026-04-24-agent-rename-design.md`
- Plan: `docs/superpowers/plans/2026-04-24-agent-rename.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope

- Backwards-compat aliases (`export type ChatAgent = Agent`).
- Renaming historical docs in `docs/superpowers/specs/2026-04-21-*` and `docs/superpowers/plans/2026-04-21-*`.
- Structural changes (new subclasses, contract reshaping).
- Renaming the `@cacheplane/chat` package itself.
