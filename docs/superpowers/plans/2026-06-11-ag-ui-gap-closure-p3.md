# AG-UI Gap Closure Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit gaps F1, F2, F3, F4, F6 from `docs/superpowers/specs/2026-06-11-ag-ui-capability-findings.md` (F5 — subagent card — is deferred to Phase 4 design).

**Architecture:** Three small library fixes (`@threadplane/chat` chat-input binding, `@threadplane/ag-ui` abort handling, chat markdown track expressions), one example-level fix (`data-color-scheme` parity with the canonical shell), and one bounded investigate-then-fix (json-render object values, shared with the canonical demo). Each fix lands TDD-first where a test can express it.

**Tech Stack:** Angular 21 signals (zoneless, OnPush), vitest + TestBed for lib units, Playwright + aimock for e2e, nx for gates.

**Branch:** `ag-ui-gap-closure-p3` off `origin/main` (the worktree's current branch holds the merged findings PR #660 — do not stack on it).

**Context for the engineer:**
- The audit evidence and root-cause notes live in `docs/superpowers/specs/2026-06-11-ag-ui-capability-findings.md`. Read it first.
- F1 was probed live: after Enter-submit, `chat-input`'s `messageText()` signal is `""` but the DOM textarea still shows the text. The `[ngModel]`/`(ngModelChange)` pair fails to write the programmatic clear back to the view (zoneless + OnPush). Reproduces on production `demo.threadplane.ai` mid-thread.
- F2 root cause: `examples/ag-ui/angular/src/styles.css` keys the page scheme off `html[data-color-scheme]`, but `AgUiShell` only sets `data-theme` + `data-threadplane-chat-theme`. The canonical shell sets `data-color-scheme` in both its runtime effect (`examples/chat/angular/src/app/shell/demo-shell.component.ts:133`) and an index.html pre-bootstrap script. The ag-ui example has neither.
- F3 root cause: `stop()` calls `source.abortRun()`; the AG-UI HttpAgent then invokes `onRunFailed({error: "BodyStreamBuffer was aborted"})`, and the adapter's handler unconditionally sets `status: 'error'`.
- F6: identity-tracked `@for` in `libs/chat/src/lib/markdown/markdown-children.component.ts:31` (`track $any(child)`) and `libs/chat/src/lib/markdown/views/markdown-table.component.ts:20` (`track $any(row)`). Markdown re-parses every stream delta, producing new child objects each time → NG0956 + full DOM re-creation per chunk.

---

### Task 0: Branch setup

- [ ] **Step 1: Create the phase branch off latest main**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/ag-ui-demo-toolbar
git fetch origin main
git checkout -b ag-ui-gap-closure-p3 origin/main
```

Expected: `Switched to a new branch 'ag-ui-gap-closure-p3'`.

---

### Task 1: F2 — `data-color-scheme` parity (example-level)

**Files:**
- Modify: `examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.ts` (theme/scheme effect, ~line 140)
- Modify: `examples/ag-ui/angular/src/index.html` (add pre-bootstrap script)
- Modify: `examples/ag-ui/angular/e2e/toolbar.spec.ts` (regression assertion)

- [ ] **Step 1: Write the failing e2e assertion**

Append to `examples/ag-ui/angular/e2e/toolbar.spec.ts`:

```ts
test('light scheme flips the page background (data-color-scheme parity)', async ({ page }) => {
  await openDemo(page, '/embed?scheme=light&theme=default-light');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
  // The page background var must resolve to the light value, not the dark default.
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--demo-page-bg').trim(),
  );
  expect(bg).toBe('#ffffff');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run (aimock harness — see `examples/ag-ui/angular/e2e/README.md`; kill any orphaned uvicorn on :8000 / serve first, `NX_DAEMON=false`):

```bash
NX_DAEMON=false npx nx e2e examples-ag-ui-angular-e2e --grep "data-color-scheme parity"
```

Expected: FAIL — `data-color-scheme` attribute missing.

- [ ] **Step 3: Set the attribute in the shell effect**

In `examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.ts`, the constructor effect currently reads:

```ts
    // Reflect theme + scheme onto <html> exactly like the canonical shell.
    effect(() => {
      const html = this.document.documentElement;
      html.setAttribute('data-theme', this.theme());
      const scheme = this.colorScheme();
      html.setAttribute('data-threadplane-chat-theme', scheme);
```

Add the page-scheme attribute alongside the chat one:

```ts
    // Reflect theme + scheme onto <html> exactly like the canonical shell.
    effect(() => {
      const html = this.document.documentElement;
      html.setAttribute('data-theme', this.theme());
      const scheme = this.colorScheme();
      html.setAttribute('data-threadplane-chat-theme', scheme);
      html.setAttribute('data-color-scheme', scheme);
```

- [ ] **Step 4: Add the pre-bootstrap script to index.html**

Replace the `<head>` of `examples/ag-ui/angular/src/index.html` with (mirrors the canonical script; note the ag-ui persistence key):

```html
  <head>
    <meta charset="utf-8" />
    <title>AG-UI Chat — Threadplane Example</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>
      // Pre-bootstrap color-scheme apply: read persisted palette and set
      // both `data-color-scheme` (drives the demo page bg/text) and
      // `data-threadplane-chat-theme` (drives the chat lib's internal theming)
      // BEFORE stylesheets load to avoid FOUC. The AgUiShell effect
      // takes over at runtime once Angular bootstraps.
      (function () {
        try {
          var raw = localStorage.getItem('threadplane-ag-ui-demo:palette');
          var scheme = 'dark';
          if (raw) {
            var p = JSON.parse(raw);
            if (p && (p.colorScheme === 'light' || p.colorScheme === 'dark')) {
              scheme = p.colorScheme;
            }
          }
          document.documentElement.setAttribute('data-color-scheme', scheme);
          document.documentElement.setAttribute('data-threadplane-chat-theme', scheme);
        } catch (e) { /* localStorage blocked — defaults apply */ }
      })();
    </script>
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
```

- [ ] **Step 5: Run the e2e spec to verify it passes**

```bash
NX_DAEMON=false npx nx e2e examples-ag-ui-angular-e2e --grep "data-color-scheme parity"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.ts examples/ag-ui/angular/src/index.html examples/ag-ui/angular/e2e/toolbar.spec.ts
git commit -m "fix(examples/ag-ui): set data-color-scheme so light mode reaches the page chrome (F2)"
```

---

### Task 2: F1 — chat-input clears the textarea after submit (`@threadplane/chat`)

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`
- Test: `libs/chat/src/lib/primitives/chat-input/chat-input.component.spec.ts`
- Modify: `examples/ag-ui/angular/e2e/send-receive.spec.ts` (integration regression)

- [ ] **Step 1: Write the failing unit test**

Append to the component-level describe blocks in `chat-input.component.spec.ts` (the file already imports `TestBed`, `ChatInputComponent`, and `mockAgent`; follow the file's existing component-test setup — use `fixture.componentRef.setInput('agent', agent)`):

```ts
describe('ChatInputComponent — clears view on submit (F1 regression)', () => {
  it('empties both the signal and the textarea DOM value after Enter submit', async () => {
    const agent = mockAgent();
    TestBed.configureTestingModule({ imports: [ChatInputComponent] });
    const fixture = TestBed.createComponent(ChatInputComponent);
    fixture.componentRef.setInput('agent', agent);
    fixture.detectChanges();

    const textarea: HTMLTextAreaElement =
      fixture.nativeElement.querySelector('textarea');
    // Simulate real typing: set the DOM value and fire the input event.
    textarea.value = 'hello world';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.messageText()).toBe('hello world');

    // Enter-key submit (the (keydown.enter) path).
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(agent.submitCalls).toHaveLength(1);
    expect(fixture.componentInstance.messageText()).toBe('');
    // The DOM must reflect the clear — this is the bug: ngModel never
    // writes the programmatic '' back to the view.
    expect(textarea.value).toBe('');
  });
});
```

- [ ] **Step 2: Run it to verify it fails on the DOM assertion**

```bash
npx nx test chat -- --run --testNamePattern "F1 regression"
```

Expected: FAIL on `expect(textarea.value).toBe('')` (received `'hello world'`).

- [ ] **Step 3: Replace the ngModel pair with direct value/input bindings**

In `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`:

a) Remove `import { FormsModule } from '@angular/forms';` and remove `FormsModule` from the component's `imports: [...]` array (it exists solely for this textarea).

b) In the template, replace:

```html
        <textarea
          #textareaEl
          class="chat-input__textarea"
          [ngModel]="messageText()"
          (ngModelChange)="messageText.set($event)"
          name="messageText"
```

with:

```html
        <textarea
          #textareaEl
          class="chat-input__textarea"
          [value]="messageText()"
          (input)="onInput($event)"
```

c) Add the handler next to `onSubmit()`:

```ts
  /** Sync the textarea's value into the signal on user input. A direct
   *  [value]/(input) pair is used instead of ngModel: NgModel does not
   *  reliably write a programmatic clear back to the view under zoneless
   *  + OnPush, leaving sent text visible in the composer (audit F1). */
  protected onInput(event: Event): void {
    this.messageText.set((event.target as HTMLTextAreaElement).value);
  }
```

d) Belt-and-braces in `onSubmit()` so the DOM clears even if the `[value]`
binding short-circuits (signal already `''` from a race):

```ts
  onSubmit(): void {
    const submitted = submitMessage(this.agent(), this.messageText());
    if (submitted !== null) {
      this.submitted.emit(submitted);
      this.messageText.set('');
      const el = this.textareaEl()?.nativeElement;
      if (el) el.value = '';
      requestAnimationFrame(() => this.textareaEl()?.nativeElement.focus());
    }
  }
```

- [ ] **Step 4: Run the chat test suite**

```bash
npx nx test chat -- --run
```

Expected: all PASS, including the new F1 test. If other specs referenced `FormsModule` behavior of chat-input (e.g. setting model values via ngModel), update them to dispatch `input` events instead.

- [ ] **Step 5: Add the integration regression to e2e**

In `examples/ag-ui/angular/e2e/send-receive.spec.ts`, add a spec that types like a user (not `fill`, which masked this bug):

```ts
test('composer clears after Enter-key send (F1 regression)', async ({ page }) => {
  await openDemo(page);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.pressSequentially('say hi briefly');
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('');
});
```

(Adjust `openDemo` import to match the file's existing helpers.)

- [ ] **Step 6: Run the e2e spec**

```bash
NX_DAEMON=false npx nx e2e examples-ag-ui-angular-e2e --grep "F1 regression"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-input/chat-input.component.ts libs/chat/src/lib/primitives/chat-input/chat-input.component.spec.ts examples/ag-ui/angular/e2e/send-receive.spec.ts
git commit -m "fix(chat): chat-input clears the textarea after submit (F1)

ngModel does not write a programmatic clear back to the view under
zoneless + OnPush, so sent text stayed in the composer. Bind
[value]/(input) directly and drop FormsModule."
```

---

### Task 3: F3 — graceful stop in `@threadplane/ag-ui`

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts`
- Test: `libs/ag-ui/src/lib/to-agent.spec.ts` (StubAgent harness with `failRun()` + `abortRun` spy already exists at the top of the file)

- [ ] **Step 1: Write the failing tests**

Append to `to-agent.spec.ts` (match the file's existing construction of `toAgent` from `StubAgent` — see neighboring tests for the exact cast):

```ts
describe('stop() — graceful cancellation (F3)', () => {
  it('treats an abort-induced onRunFailed as cancellation, not error', async () => {
    const source = new StubAgent();
    // Keep the run in flight so stop() races it like a real stream.
    let resolveRun!: () => void;
    source.runAgent.mockImplementation(
      () => new Promise<{ result: undefined; newMessages: [] }>((res) => {
        resolveRun = () => res({ result: undefined, newMessages: [] });
      }),
    );
    const agent = toAgent(source as never);

    const pending = agent.submit({ message: 'long story' });
    await agent.stop!();
    expect(source.abortRun).toHaveBeenCalledTimes(1);

    // HttpAgent surfaces the abort as a run failure.
    source.failRun(new Error('BodyStreamBuffer was aborted'));
    resolveRun();
    await pending;

    expect(agent.status()).toBe('idle');
    expect(agent.error()).toBeNull();
    expect(agent.isLoading()).toBe(false);
  });

  it('still surfaces real failures as errors after a previous stop', async () => {
    const source = new StubAgent();
    const agent = toAgent(source as never);

    // A stop on an earlier run must not swallow later genuine failures.
    await agent.stop!();
    await agent.submit({ message: 'hi' }); // resets the abort flag
    source.failRun(new Error('boom'));

    expect(agent.status()).toBe('error');
    expect(agent.error()).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Run to verify the first test fails**

```bash
npx nx test ag-ui -- --run --testNamePattern "graceful cancellation"
```

Expected: first test FAILS (`status()` is `'error'`); second may pass already.

- [ ] **Step 3: Implement abort-aware failure handling**

In `libs/ag-ui/src/lib/to-agent.ts`:

a) Near `let activeRun ...` add:

```ts
  // Set by stop(); lets run-failure handlers distinguish a user-initiated
  // abort (graceful cancel) from a genuine stream failure.
  let abortRequested = false;

  function isAbortError(error: unknown): boolean {
    return error instanceof Error
      && (error.name === 'AbortError' || /abort/i.test(error.message));
  }

  /** Returns true (and finalizes the store as idle) for stop()-induced failures. */
  function settleIfAborted(error: unknown): boolean {
    if (!abortRequested || !isAbortError(error)) return false;
    abortRequested = false;
    store.status.set('idle');
    store.isLoading.set(false);
    // Not a failure: leave store.error null and close out telemetry as a
    // normal finish so the aborted run doesn't count as errored.
    if (activeRun) finishRunTelemetry(activeRun);
    return true;
  }
```

(If `finishRunTelemetry(activeRun)` double-fires when the submit catch also settles, guard with the same `run.errored`-style idempotence the existing helpers use — read them and keep telemetry emitted at most once per run.)

b) In the subscriber:

```ts
    onRunFailed({ error }) {
      if (settleIfAborted(error)) return;
      store.status.set('error');
      store.isLoading.set(false);
      store.error.set(error);
      failRunTelemetry(error);
    },
```

c) In **both** catch blocks inside `submit` (normal and resume paths):

```ts
        } catch (err) {
          if (!settleIfAborted(err)) {
            store.status.set('error');
            store.isLoading.set(false);
            store.error.set(err);
            failRunTelemetry(err, run);
          }
        }
```

d) Reset the flag at the start of each run (top of `submit`, before either path):

```ts
      abortRequested = false;
```

e) Set it in `stop()`:

```ts
    stop: async () => {
      abortRequested = true;
      source.abortRun();
    },
```

- [ ] **Step 4: Run the ag-ui suite**

```bash
npx nx test ag-ui -- --run
```

Expected: all PASS (132+ tests including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/src/lib/to-agent.ts libs/ag-ui/src/lib/to-agent.spec.ts
git commit -m "fix(ag-ui): treat stop()-induced aborts as graceful cancellation (F3)

abortRun() makes the AG-UI client report onRunFailed('BodyStreamBuffer
was aborted'), which rendered a red error banner for a user-initiated
stop. Track abort intent and settle the store as idle instead."
```

---

### Task 4: F6 — stable track expressions in streaming markdown

**Files:**
- Modify: `libs/chat/src/lib/markdown/markdown-children.component.ts:31`
- Modify: `libs/chat/src/lib/markdown/views/markdown-table.component.ts:20`

- [ ] **Step 1: Switch identity tracking to positional tracking**

Markdown re-parses on every stream delta, so child objects are always new — identity tracking re-creates the whole subtree per chunk (NG0956 observed throughout the audit). Position is the stable key here.

In `markdown-children.component.ts:31` change:

```html
    @for (child of children(); track $any(child)) {
```

to:

```html
    @for (child of children(); track $index) {
```

In `views/markdown-table.component.ts:20` change:

```html
        @for (row of bodyRows(); track $any(row)) {
```

to:

```html
        @for (row of bodyRows(); track $index) {
```

(If either file has a sibling inner `@for` with identity tracking on the same re-parsed objects — e.g. row cells — apply the same change; do not touch loops keyed on `.id`/`.key`/`.value`.)

- [ ] **Step 2: Run the chat suite (markdown specs cover these views)**

```bash
npx nx test chat -- --run
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/markdown/markdown-children.component.ts libs/chat/src/lib/markdown/views/markdown-table.component.ts
git commit -m "perf(chat): track markdown children by index, not identity (F6)

Re-parsed markdown produces new child objects every stream delta;
identity tracking re-created the DOM subtree per chunk (NG0956)."
```

---

### Task 5: F4 — json-render `[object Object]` values (bounded investigate-then-fix)

**Files (investigation entry points):**
- Read: `examples/ag-ui/python/src/schemas/json_render.py` (what value shapes the graph instructs the model to emit — note line ~37: "`state` is the initial state model. Keys are paths; values are initial values")
- Read: `libs/render/src/lib/internals/prop-signal.ts` (prop resolution context — how component props bind to spec/state values)
- Read: the json-render view host in `libs/chat` — locate with `grep -rn "json-render\|jsonRender" libs/chat/src/lib --include="*.ts" | grep -v spec`
- Test: colocated `.spec.ts` next to whichever file owns the bug

**Symptom (from the audit):** dashboard specs render `[object Object]` for metric values ("Total Revenue", "Revenue target:", search default) and a literal icon name `trending_up` as text. Reproduces identically on the production canonical demo, so the bug is in the shared render pipeline or the spec schema/prompt — NOT the AG-UI adapter.

- [ ] **Step 1: Capture a minimal failing spec**

Build a minimal spec fixture matching what the graph emits (read `json_render.py` to get the exact component vocabulary — e.g. a metric/text node whose value is an object like `{ "path": "/metrics/total" }` or `{ "value": 1200000, "format": "currency" }`). Write a unit test in the owning component/engine spec that renders the fixture and asserts the resolved text is the scalar (e.g. `"1200000"` or the state value at the path), not `"[object Object]"`.

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx nx test render -- --run --testNamePattern "object value"   # or `chat`, wherever the test landed
```

Expected: FAIL showing `[object Object]`.

- [ ] **Step 3: Decide the fix location by this rule**

- If the schema (json_render.py / the JSON Schema it embeds) **documents** object-shaped values (`{path}` refs or `{value, format}`), the renderer must resolve them: implement resolution in the prop/value path (`prop-signal.ts` or the leaf view) — dereference `path` against the spec state store, apply `format` when present, and fall back to `String(value)` only for scalars.
- If the schema says values are **scalars** and the model is hallucinating objects, fix the schema/prompt in `examples/ag-ui/python/src/schemas/json_render.py` AND its cockpit twin (`grep -rln "json_render" examples/chat/python cockpit 2>/dev/null` — cockpit examples are standalone copies; update each, never share). Add a renderer-side `String()` guard for graceful degradation either way.
- The icon-name-as-text symptom (`trending_up`) follows the same rule: either the renderer must map icon nodes to an icon view, or the schema must not offer icons it can't render. If icon support turns out to be a missing *feature* (not a binding bug), note it in the findings doc as follow-up and do NOT build an icon system in this task.

**Escalation rule:** if the fix requires redesigning the spec schema or adding a new component catalog, STOP after Step 2, write findings to the task report, and return status BLOCKED with what you learned — do not expand scope.

- [ ] **Step 4: Implement minimal fix, re-run the failing test**

```bash
npx nx test render -- --run && npx nx test chat -- --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A libs/render libs/chat examples
git commit -m "fix(render): resolve object-shaped json-render values to scalars (F4)"
```

(Adjust scope/message to where the fix actually landed.)

---

### Task 6: Gates, live smoke, PR

- [ ] **Step 1: Library gates**

```bash
npx nx run-many -t lint,test,build -p chat,ag-ui,render
```

Expected: all green.

- [ ] **Step 2: Example build (strict:false example builds catch different errors — build before claiming green)**

```bash
npx nx build examples-ag-ui-angular
```

Expected: green.

- [ ] **Step 3: Full ag-ui e2e (aimock)**

```bash
NX_DAEMON=false npx nx e2e examples-ag-ui-angular-e2e
```

Expected: all specs green (13+ including the two new regressions). Kill any live-serve processes holding :8000/:4201 first — e2e and live serve must not share ports.

- [ ] **Step 4: Live-LLM Chrome smoke (required gate before merge)**

Start the real backend + app (real `OPENAI_API_KEY` from root `.env`), then verify in Chrome:
1. Light scheme: itinerary panel + popup/sidebar mode hosts go light.
2. Type a message + Enter: composer clears (embed AND popup).
3. Send a long prompt, click stop mid-stream: stream halts, NO red error banner, send button returns to idle.
4. `genui=json-render` + "Build me a revenue dashboard": metric values render as numbers/strings, not `[object Object]` (if F4's fix was schema-side, expect improvement on fresh runs only).
5. Console: no NG0956 warnings during streaming.

- [ ] **Step 5: PR + merge on green**

```bash
git push -u origin ag-ui-gap-closure-p3
gh pr create --title "fix: close AG-UI audit gaps F1-F4, F6 (composer clear, light scheme, graceful stop, json-render values, markdown tracking)" --body "<summarize per-gap fixes + evidence; link docs/superpowers/specs/2026-06-11-ag-ui-capability-findings.md>"
gh pr merge --auto --squash <PR#>
```

---

## Self-review notes

- Spec coverage: F1→Task 2, F2→Task 1, F3→Task 3, F4→Task 5, F6→Task 4; F5 explicitly deferred (Phase 4). Verification matrix re-run is Task 6 Step 4.
- Type consistency: `settleIfAborted`/`isAbortError`/`abortRequested` are defined and used only in Task 3; `onInput` defined and referenced only in Task 2.
- Known risk: Task 5 is investigate-then-fix with an explicit escalation rule instead of pretending the fix is known.
