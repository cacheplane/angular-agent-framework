# Canonical `examples/chat` Demo — Smoke fixes A+B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Findings A (palette dropdowns ignore signal value on initial render) and B (reasoning blocks have empty summary) as a single quick-fix PR.

**Architecture:** Three independent edits — palette template `[selected]` bindings (Angular), python graph `reasoning.summary='auto'` kwarg (Python), adapter `extractReasoning` extension to read summary items (libs/langgraph). Each is small and testable in isolation.

**Tech Stack:** Angular 21 (standalone, signals, OnPush), Python 3.12 (uv, langgraph, langchain-openai), TypeScript (libs/langgraph + vitest spec).

**Spec:** `docs/superpowers/specs/2026-05-08-canonical-chat-smoke-fixes-a-b-design.md`

**Branch:** `claude/examples-chat-smoke-fixes-a-b`, branched from `origin/main`.

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commits, PR bodies, or docs.

---

## File Structure

```
examples/chat/
├── angular/src/app/shell/control-palette.component.html   # +2 [selected] bindings
└── python/src/graph.py                                     # +1 kwargs key

libs/langgraph/src/lib/internals/
├── stream-manager.bridge.ts                                # extend extractReasoning
└── stream-manager.bridge.spec.ts                           # +1 unit test (TDD)
```

Total ≈ 25 LOC. ~4 commits.

---

## Phase 0 — Branch creation

### Task 0.1: Create implementation branch

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/examples-chat-smoke-fixes-a-b origin/main
```

- [ ] **Step 2: Verify**

```bash
git rev-parse --abbrev-ref HEAD
```

Expected: `claude/examples-chat-smoke-fixes-a-b`.

```bash
git log --oneline -1
```

Expected: a commit on `origin/main`.

---

## Phase 1 — Finding A: palette dropdown initial value

### Task 1.1: Add `[selected]` bindings to palette dropdowns

**Files:**
- Modify: `examples/chat/angular/src/app/shell/control-palette.component.html`

- [ ] **Step 1: Locate the Model dropdown**

Open `examples/chat/angular/src/app/shell/control-palette.component.html`. Find the Model select:

```html
    <label class="palette__group palette__group--model">
      <span class="palette__label">Model</span>
      <select [value]="model()" (change)="pickModel($event)">
        @for (opt of modelOptions(); track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
    </label>
```

Replace the `<option>` line with one that adds `[selected]="opt.value === model()"`:

```html
    <label class="palette__group palette__group--model">
      <span class="palette__label">Model</span>
      <select [value]="model()" (change)="pickModel($event)">
        @for (opt of modelOptions(); track opt.value) {
          <option [value]="opt.value" [selected]="opt.value === model()">{{ opt.label }}</option>
        }
      </select>
    </label>
```

- [ ] **Step 2: Same for Effort dropdown**

Find the Effort select directly below:

```html
    <label class="palette__group palette__group--model">
      <span class="palette__label">Effort</span>
      <select [value]="effort()" (change)="pickEffort($event)">
        @for (opt of effortOptions(); track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
    </label>
```

Replace its `<option>` line:

```html
    <label class="palette__group palette__group--model">
      <span class="palette__label">Effort</span>
      <select [value]="effort()" (change)="pickEffort($event)">
        @for (opt of effortOptions(); track opt.value) {
          <option [value]="opt.value" [selected]="opt.value === effort()">{{ opt.label }}</option>
        }
      </select>
    </label>
```

- [ ] **Step 3: Build to verify type-correctness**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -5
```

Expected: build SUCCEEDS.

- [ ] **Step 4: Run vitest specs**

```bash
npx nx run examples-chat-angular:test --skip-nx-cache 2>&1 | tail -5
```

Expected: 9 tests pass (no spec changes; this just confirms no regression).

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/shell/control-palette.component.html
git commit -m "fix(examples-chat-angular): palette dropdowns honor signal value on initial render"
```

---

## Phase 2 — Finding B part 1: python graph requests reasoning summary

### Task 2.1: Add `summary: "auto"` to the reasoning kwargs

**Files:**
- Modify: `examples/chat/python/src/graph.py`

- [ ] **Step 1: Locate the `generate` function**

Open `examples/chat/python/src/graph.py`. Find the reasoning block:

```python
async def generate(state: State) -> dict:
    model_name = state.get("model") or "gpt-5-mini"
    kwargs = {"model": model_name, "streaming": True}
    if _is_reasoning_model(model_name):
        # Honor the client's effort selection when present; default to
        # 'minimal' so first-token latency stays low for unconfigured callers.
        effort = state.get("reasoning_effort") or "minimal"
        kwargs["reasoning"] = {"effort": effort}
    llm = ChatOpenAI(**kwargs)
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = await llm.ainvoke(messages)
    return {"messages": [response]}
```

- [ ] **Step 2: Add the `summary` key**

Replace the `kwargs["reasoning"]` line with:

```python
        # `summary='auto'` instructs the OpenAI Responses API to emit
        # summary text inside the reasoning block (otherwise the block
        # arrives with an empty `summary: []` and the chat UI has nothing
        # to render). The adapter's `extractReasoning` reads either the
        # legacy `block.text` field or the modern `block.summary[].text`.
        kwargs["reasoning"] = {"effort": effort, "summary": "auto"}
```

- [ ] **Step 3: Run pytest smoke**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: 2 passed (no spec changes; just confirming the file still parses).

- [ ] **Step 4: Run through Nx**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -3
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/python/src/graph.py
git commit -m "fix(examples-chat-python): request reasoning.summary='auto'"
```

---

## Phase 3 — Finding B part 2: adapter `extractReasoning` reads summary items (TDD)

### Task 3.1: Write failing unit test

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`

- [ ] **Step 1: Locate the existing extractReasoning tests**

Open `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`. The bottom of the file has internal-helper unit tests; find:

```ts
  const { extractReasoning, accumulateReasoning } = _internalsForTesting;
```

(usually around line 1000+).

After the existing `extractReasoning`-related tests, add a new test:

```ts
  it('extractReasoning pulls text from OpenAI Responses API summary items', () => {
    const content = [
      {
        type: 'reasoning',
        summary: [
          { type: 'summary_text', text: 'First thought. ' },
          { type: 'summary_text', text: 'Second thought.' },
        ],
      },
      { type: 'text', text: 'Visible answer' },
    ];
    expect(extractReasoning(content)).toBe('First thought. Second thought.');
  });

  it('extractReasoning ignores summary items missing text', () => {
    const content = [
      {
        type: 'reasoning',
        summary: [
          { type: 'summary_text', text: 'Kept. ' },
          { type: 'summary_text' },           // no text field
          null,                                // null entry
          { text: 'Also kept.' },              // no type, but has text
        ],
      },
    ];
    expect(extractReasoning(content)).toBe('Kept. Also kept.');
  });
```

- [ ] **Step 2: Run the spec**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -10
```

Expected: BOTH new tests FAIL — `extractReasoning` currently returns `''` for these inputs because it only looks at `block.text`, not `block.summary[].text`.

If somehow they pass already, double-check that the test file actually saved.

Do NOT commit — Task 3.2 commits test + implementation together.

### Task 3.2: Extend `extractReasoning` to read summary items

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`

- [ ] **Step 1: Locate the function**

Open `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`. Find:

```ts
function extractReasoning(content: unknown): string {
  if (typeof content === 'string') return '';
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (block == null || typeof block !== 'object') continue;
    const rec = block as Record<string, unknown>;
    const t = rec['type'];
    if (t === 'reasoning' || t === 'thinking') {
      const text = rec['text'];
      if (typeof text === 'string') out += text;
    }
  }
  return out;
}
```

- [ ] **Step 2: Replace with the summary-aware version**

```ts
function extractReasoning(content: unknown): string {
  if (typeof content === 'string') return '';
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (block == null || typeof block !== 'object') continue;
    const rec = block as Record<string, unknown>;
    const t = rec['type'];
    if (t === 'reasoning' || t === 'thinking') {
      // Direct text field — Anthropic-style "thinking" blocks and
      // some LangChain-shaped reasoning blocks land here.
      const text = rec['text'];
      if (typeof text === 'string') out += text;
      // OpenAI Responses API: when `reasoning.summary='auto'` was
      // requested, reasoning blocks carry a `summary` array of
      // `{type: 'summary_text', text: '...'}` items. Concatenate
      // their texts in order.
      const summary = rec['summary'];
      if (Array.isArray(summary)) {
        for (const item of summary) {
          if (item == null || typeof item !== 'object') continue;
          const itemText = (item as Record<string, unknown>)['text'];
          if (typeof itemText === 'string') out += itemText;
        }
      }
    }
  }
  return out;
}
```

- [ ] **Step 3: Run the spec — both new tests now pass**

```bash
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -10
```

Expected: all langgraph tests pass, including the two new `extractReasoning` cases. The pre-existing extractReasoning tests must STILL pass (the change is additive).

If a pre-existing `extractReasoning` test fails, the new code regressed the legacy `block.text` path. Re-read the implementation against Step 2 — the `block.text` extraction must remain.

- [ ] **Step 4: Lint**

```bash
npx nx run langgraph:lint --skip-nx-cache 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.ts \
        libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "fix(langgraph): extractReasoning reads OpenAI summary items"
```

---

## Phase 4 — Verification + PR

### Task 4.1: Full local verification sweep

- [ ] **Step 1: Lint everything we touched**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run-many -t lint --projects=examples-chat-angular,langgraph --skip-nx-cache 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 2: Test everything we touched**

```bash
npx nx run-many -t test --projects=examples-chat-angular,langgraph --skip-nx-cache 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Build the angular demo**

```bash
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 4: Pytest smoke**

```bash
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -3
```

Expected: 2 passed.

- [ ] **Step 5: Server-side reasoning probe**

Confirm `OPENAI_API_KEY` is in `examples/chat/python/.env`:

```bash
ls examples/chat/python/.env || (grep "OPENAI_API_KEY" .env > examples/chat/python/.env)
cat examples/chat/python/.env | head -1 | cut -c1-30
```

Start the backend in the background:

```bash
nohup uv run --directory examples/chat/python langgraph dev --port 2024 --no-browser > /tmp/exchat-py-ab.log 2>&1 &
sleep 4
curl -sf http://localhost:2024/ok && echo " backend OK"
```

Send a request that exercises summary='auto':

```bash
tid=$(curl -sf -X POST -H 'Content-Type: application/json' http://localhost:2024/threads -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")
echo "thread=$tid"
r=$(curl -sf -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid/runs/wait" \
  -d "{\"assistant_id\":\"chat\",\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"What is 47*53? Show your reasoning briefly.\"}],\"model\":\"gpt-5\",\"reasoning_effort\":\"high\"}}")
echo "$r" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ai = [m for m in d.get('messages', []) if m.get('type') == 'ai']
if not ai: print('NO AI'); exit(1)
content = ai[-1].get('content', [])
if not isinstance(content, list): print('content not list:', type(content).__name__); exit(1)
for b in content:
  if b.get('type') == 'reasoning':
    summary = b.get('summary', [])
    print('reasoning summary len:', len(summary))
    for item in summary[:2]:
      print('  summary_item:', item.get('type'), '-', (item.get('text') or '')[:60])
  elif b.get('type') == 'text':
    print('text len:', len(b.get('text', '')))
"
```

Expected: `reasoning summary len:` is greater than 0, AND each `summary_item` has type `summary_text` with non-empty text. This confirms the python graph now requests + receives reasoning summary content.

- [ ] **Step 6: Stop the backend**

```bash
pkill -f "langgraph dev" 2>/dev/null
sleep 1
lsof -nP -iTCP:2024 -sTCP:LISTEN 2>&1 | head -2
```

Expected: nothing listening on :2024.

- [ ] **Step 7: Confirm commit count**

```bash
git rev-list --count origin/main..HEAD
```

Expected: 3 commits.

### Task 4.2: Push branch + open PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/examples-chat-smoke-fixes-a-b 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "fix(examples-chat): smoke pass findings A+B (palette dropdowns + reasoning summary)" --body "$(cat <<'EOF'
## Summary

Two small bug fixes surfaced by the live Chrome smoke pass against the workspace demo.

### A) Palette dropdowns ignore signal value on initial render

The Model and Effort `<select>` elements in the control palette showed the first option (`gpt-5`, `minimal (fast)`) on initial render instead of the persisted/signal value. Cause: `[value]` on `<select>` fires before the `@for` loop materializes `<option>` children; with no matching option, the select falls back to its first option.

Fix: add `[selected]="opt.value === model()"` (and equivalent for effort) on each option. Angular sets `selected` on the matching option during the same change-detection pass that populates the `@for`, so first paint is correct.

### B) Reasoning blocks have empty `summary: []`

The python graph requested `reasoning.effort` but not `reasoning.summary='auto'`, so OpenAI returned `{type: 'reasoning', summary: []}` — a placeholder block with no text content. `<chat-reasoning>` had nothing to render even though gpt-5 was reasoning internally.

Fix: extend the python kwargs to include `summary='auto'`, and extend the `@ngaf/langgraph` adapter's `extractReasoning` helper to read text from OpenAI summary items (keeps the existing `block.text` path for Anthropic thinking blocks).

## Test plan

### Verified locally
- [x] `nx run examples-chat-angular:lint test build` — green
- [x] `nx run langgraph:lint test` — green (2 new spec cases for `extractReasoning` summary path)
- [x] `nx run examples-chat-python:smoke` — 2 passed
- [x] **Server-side probe** with model=gpt-5, effort=high: response now includes a reasoning block with non-empty `summary_text` items. Thread state captures the effort.

### Pending visual verification
- [ ] Reload at `/embed` after changing model — palette shows the persisted option (not the first option)
- [ ] Send the puzzle prompt with effort=high — `<chat-reasoning>` pill appears with the summarized thinking text

(Visual sweep continues against issue #214; Findings C/D/E/F deferred to separate brainstorms.)

Spec: `docs/superpowers/specs/2026-05-08-canonical-chat-smoke-fixes-a-b-design.md`
Plan: `docs/superpowers/plans/2026-05-08-canonical-chat-smoke-fixes-a-b.md`
EOF
)"
```

- [ ] **Step 3: Note the PR URL.**

- [ ] **Step 4: Wait for CI; address failures.**

- [ ] **Step 5: Merge once green.**

---

## Definition of done

1. PR merged.
2. CI green: `examples-chat-angular:test/lint/build`, `langgraph:test/lint`, `examples-chat-python:smoke`.
3. Server-side probe confirms `summary='auto'` round-trips (reasoning blocks now have populated `summary_text` items).
4. Local visual smoke (manual): palette dropdowns show persisted/signal value on first paint; `<chat-reasoning>` renders for the puzzle prompt with model=gpt-5, effort=high.
