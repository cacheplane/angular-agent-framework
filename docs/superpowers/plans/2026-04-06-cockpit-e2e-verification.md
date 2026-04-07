# Cockpit Examples E2E Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is SEQUENTIAL — each task requires a running server and Chrome browser verification that cannot be parallelized.

**Goal:** Verify every cockpit capability example works end-to-end — Angular UI renders, Python backend responds, messages stream correctly, sidebar features display properly, and zero console errors. Fix any issues found in the chat/angular libs.

**Architecture:** For each example: start the serve script (Angular + Python), navigate Chrome to the port, send a test message, verify the response renders, check the capability-specific sidebar, screenshot for evidence, check console for errors. Kill servers between examples.

**Tech Stack:** Chrome extension (MCP), `serve-example.ts` script, Angular dev server, LangGraph Python backend

---

## Prerequisites

Before starting, ensure:
1. `.env` symlinks exist for all Python backends (OPENAI_API_KEY)
2. `uv` is installed for Python venv creation
3. Chrome extension is connected

```bash
# Symlink .env for all Python backends
for dir in cockpit/langgraph/*/python cockpit/deep-agents/*/python; do
  ln -sf /Users/blove/repos/angular/.env "$dir/.env"
done
```

## Verification Protocol (same for each task)

```
1. Kill any running servers on relevant ports
2. Start: npx tsx apps/cockpit/scripts/serve-example.ts --capability=<id>
3. Wait for Angular (port) + Python (port+3823) to be ready
4. Navigate Chrome to http://localhost:<port>
5. Screenshot empty state
6. Send test message via JS injection
7. Wait for response (10-15s)
8. Screenshot conversation
9. Check console for errors
10. Verify capability-specific feature (sidebar, interrupt panel, etc.)
11. If issues found: fix in lib, rebuild, re-verify
12. Kill servers
```

---

## Capability Registry

| Task | ID | Port | Python Port | Capability Feature | Test Message |
|------|-----|------|-------------|-------------------|-------------|
| 1 | streaming | 4300 | 8123 | Basic chat | "What is 2+2?" |
| 2 | persistence | 4301 | 8124 | Thread sidebar | "Hi" then switch thread |
| 3 | interrupts | 4302 | 8125 | Interrupt panel | "Approve this" |
| 4 | memory | 4303 | 8126 | Facts sidebar | "My name is Alice" |
| 5 | durable-execution | 4304 | 8129 | Step progress | "Write a short poem" |
| 6 | subgraphs | 4305 | 8128 | Subagent sidebar | "Research quantum computing" |
| 7 | time-travel | 4306 | 8127 | Checkpoint timeline | "Tell me a joke" |
| 8 | deployment-runtime | 4307 | 8130 | Production config | "Hello" |
| 9 | planning | 4310 | 8140 | Plan checklist | "Plan a birthday party" |
| 10 | filesystem | 4311 | 8141 | File ops log | "Read the config file" |
| 11 | da-subagents | 4312 | 8142 | Delegation tracker | "Analyze this topic" |
| 12 | da-memory | 4313 | 8143 | Learned facts | "My favorite color is blue" |
| 13 | skills | 4314 | 8144 | Skill invocations | "Calculate 15 * 7" |
| 14 | sandboxes | 4315 | 8145 | Execution output | "Write Python code to print hello" |

---

## Task 1: Streaming (baseline)

- [ ] **Step 1: Start streaming example**

```bash
lsof -ti:4300 | xargs kill -9 2>/dev/null; lsof -ti:8123 | xargs kill -9 2>/dev/null
npx tsx apps/cockpit/scripts/serve-example.ts --capability=streaming
```

Wait for both Angular (4300) and Python (8123) to return 200.

- [ ] **Step 2: Navigate Chrome and verify empty state**

Navigate to `http://localhost:4300`. Screenshot. Verify:
- Avatar "A" centered
- "Send a message to start a conversation" text
- Pill-shaped input with send button
- No console errors

- [ ] **Step 3: Send test message and verify response**

Send "What is 2+2?" via JS injection. Wait 10s. Screenshot. Verify:
- Human bubble (right-aligned) shows "What is 2+2?"
- AI response (left-aligned with avatar) shows answer
- No console errors
- Input refocused

- [ ] **Step 4: Send follow-up and verify threading**

Send "What about 3+3?" via JS injection. Wait 10s. Screenshot. Verify:
- ALL 4 messages visible (human1, ai1, human2, ai2)
- Conversation is threaded (previous messages preserved)
- Auto-scrolled to bottom

- [ ] **Step 5: Record result**

Log: PASS or FAIL with details. If FAIL, fix and re-verify before proceeding.

- [ ] **Step 6: Kill servers**

```bash
lsof -ti:4300 | xargs kill -9 2>/dev/null; lsof -ti:8123 | xargs kill -9 2>/dev/null
```

---

## Task 2: Persistence (thread sidebar)

- [ ] **Step 1: Start persistence example**

```bash
npx tsx apps/cockpit/scripts/serve-example.ts --capability=persistence
```

Wait for Angular (4301) + Python (8124).

- [ ] **Step 2: Verify empty state with thread sidebar**

Navigate to `http://localhost:4301`. Screenshot. Verify:
- Chat area on left
- Thread sidebar on right with "Threads" header
- "No threads yet" or empty list
- "New Thread" button visible (if implemented)

- [ ] **Step 3: Send message and verify thread creation**

Send "Hi there". Wait 10s. Verify:
- Message + response render
- Thread appears in sidebar with truncated ID
- Thread is highlighted as active

- [ ] **Step 4: Record result and kill servers**

---

## Task 3: Interrupts (interrupt panel)

- [ ] **Step 1: Start interrupts example**

```bash
npx tsx apps/cockpit/scripts/serve-example.ts --capability=interrupts
```

Wait for Angular (4302) + Python (8125).

- [ ] **Step 2: Send message and verify interrupt panel**

Send "Please approve this action". Wait 10s. Verify:
- Message sends
- Interrupt panel appears (if backend triggers interrupt)
- Accept/Edit/Respond/Ignore buttons visible
- Warning styling with yellow/amber theme

- [ ] **Step 3: Record result and kill servers**

---

## Task 4: Memory (facts sidebar)

- [ ] **Step 1: Start memory example**

```bash
npx tsx apps/cockpit/scripts/serve-example.ts --capability=memory
```

Wait for Angular (4303) + Python (8126).

- [ ] **Step 2: Send message with personal info and verify facts extraction**

Send "My name is Alice and I work at Acme Corp". Wait 15s. Verify:
- Message + response render
- Facts sidebar shows extracted facts (name: Alice, company: Acme Corp)
- Facts count in header

- [ ] **Step 3: Record result and kill servers**

---

## Task 5: Durable Execution (step progress)

- [ ] **Step 1: Start durable-execution example**

```bash
npx tsx apps/cockpit/scripts/serve-example.ts --capability=durable-execution
```

Wait for Angular (4304) + Python (8129).

- [ ] **Step 2: Send message and verify step progress**

Send "Write a short poem about the ocean". Wait 15s. Verify:
- Message + response render
- Step sidebar shows 3-step pipeline (analyze/plan/generate)
- Steps show completion status (checkmarks for completed steps)

- [ ] **Step 3: Record result and kill servers**

---

## Task 6: Subgraphs (subagent sidebar)

- [ ] **Step 1: Start subgraphs example**

```bash
npx tsx apps/cockpit/scripts/serve-example.ts --capability=subgraphs
```

Wait for Angular (4305) + Python (8128).

- [ ] **Step 2: Send message and verify subagent tracking**

Send "Research quantum computing". Wait 15s. Verify:
- Message + response render
- Subagent sidebar shows entries with status badges
- Status colors: green (complete), amber (running)

- [ ] **Step 3: Record result and kill servers**

---

## Task 7: Time Travel (checkpoint timeline)

- [ ] **Step 1: Start time-travel example**

```bash
npx tsx apps/cockpit/scripts/serve-example.ts --capability=time-travel
```

Wait for Angular (4306) + Python (8127).

- [ ] **Step 2: Send message and verify checkpoint timeline**

Send "Tell me a joke". Wait 10s. Then send "Tell me another". Wait 10s. Verify:
- Both exchanges visible
- Timeline sidebar shows checkpoints (numbered entries)
- Replay/Fork buttons visible per checkpoint

- [ ] **Step 3: Record result and kill servers**

---

## Task 8: Deployment Runtime (production config)

- [ ] **Step 1: Start deployment-runtime example**

```bash
npx tsx apps/cockpit/scripts/serve-example.ts --capability=deployment-runtime
```

Wait for Angular (4307) + Python (8130).

- [ ] **Step 2: Send message and verify basic chat**

Send "Hello". Wait 10s. Verify:
- Message + response render (basic chat, no sidebar)
- No console errors
- This example validates production configuration patterns

- [ ] **Step 3: Record result and kill servers**

---

## Tasks 9-14: Deep Agent Examples

Each follows the same protocol. For each:

### Task 9: Planning
- Port 4310, capability=planning
- Test: "Plan a birthday party"
- Verify: Plan checklist sidebar with step status indicators

### Task 10: Filesystem
- Port 4311, capability=filesystem
- Test: "Read the config file and tell me what's in it"
- Verify: File operations log sidebar showing read_file tool calls

### Task 11: DA-Subagents
- Port 4312, capability=da-subagents
- Test: "Analyze the impact of AI on education"
- Verify: Delegation tracker sidebar with agent names and status dots

### Task 12: DA-Memory
- Port 4313, capability=da-memory
- Test: "My favorite color is blue and I love hiking"
- Verify: Learned facts sidebar with extracted entries

### Task 13: Skills
- Port 4314, capability=skills
- Test: "Calculate 15 * 7"
- Verify: Skill invocations sidebar showing calculator tool call with input/output

### Task 14: Sandboxes
- Port 4315, capability=sandboxes
- Test: "Write Python code that prints the numbers 1 to 5"
- Verify: Execution output sidebar showing code + stdout

---

## Task 15: Final Report

- [ ] **Step 1: Compile results**

Create a verification report with PASS/FAIL for each example:

| Example | UI Renders | Backend Works | Threading | Sidebar | Console Clean | Status |
|---------|-----------|--------------|-----------|---------|--------------|--------|
| streaming | | | | N/A | | |
| persistence | | | | | | |
| ... | | | | | | |

- [ ] **Step 2: Fix any failures**

For each FAIL:
1. Diagnose root cause
2. Fix in the lib (not the example)
3. Re-verify the failing example
4. Commit fix

- [ ] **Step 3: Commit verification report**

```bash
git add docs/superpowers/plans/
git commit -m "docs: add cockpit E2E verification results"
```
