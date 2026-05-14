# UI Polish — Debug Toggle to Bottom-Left + Missing Sidebar Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `chat-debug` toggle pill from bottom-right to bottom-left, and add the missing `<chat-launcher-button>` to the `chat-sidebar` composition so the sidebar mode is actually openable.

**Architecture:** Two small surgical edits in `libs/chat`: a single CSS property change in `chat-debug.component.ts` (`right: 20px` → `left: 20px`), and a three-line addition to `chat-sidebar.component.ts` mirroring the existing pattern in `chat-popup.component.ts`. One new spec assertion to lock in the sidebar launcher render.

**Tech Stack:** Angular 21 standalone components, signal model inputs, vitest, CSS-in-TS (template-literal styles).

**Reference spec:** `docs/superpowers/specs/2026-05-13-chat-debug-launcher-left-design.md`

---

### Task 1: Move chat-debug launcher pill to bottom-left

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts:52`

**Context:** The `.launcher` rule in the inline `styles` template uses `position: fixed; bottom: 20px; right: 20px;`. We change `right` to `left`. No other change. The `.panel--right` / `.panel--left` / `.panel--bottom` dock variants reference their own viewport edges and are unaffected — they tile to whichever edge the user picks in the debug panel's dock controls.

There is no unit test for this CSS — the style is a template literal containing CSS, and asserting that strings contain `left: 20px` rather than `right: 20px` has near-zero defect-catching value. Manual verification covers it.

---

- [ ] **Step 1: Locate the rule**

Open `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` and find lines ~48–67 — the `.launcher` selector inside the inline styles template. The exact block reads:

```css
    .launcher {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: inline-flex;
```

- [ ] **Step 2: Change `right` to `left`**

Replace `right: 20px;` with `left: 20px;` on that one line. The resulting block:

```css
    .launcher {
      position: fixed;
      bottom: 20px;
      left: 20px;
      display: inline-flex;
```

Nothing else in the file changes.

- [ ] **Step 3: Run the chat-debug spec to confirm nothing broke**

```
cd libs/chat && npx vitest run src/lib/compositions/chat-debug/chat-debug.component.spec.ts
```

Expected: PASS — existing tests don't assert on launcher position, so the change is invisible to them.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts
git commit -m "fix(chat-debug): move toggle pill to bottom-left

Previously the .launcher rule anchored to bottom-right (right: 20px)
where it collided with chat-popup's chat-launcher-button (also 56×56
at bottom-right). The debug pill rendered later in the DOM with
z-index: 990, so clicks at that corner reached debug — never the
popup launcher. Moving the debug pill to the opposite corner
(left: 20px) resolves the collision and frees up the canonical
bottom-right slot for user-facing chat launchers.

Verified via demo.cacheplane.ai browser smoke (elementsFromPoint at
the collision point returned [debug-toggle, ..., popup-launcher]).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add launcher button to chat-sidebar composition

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts`

**Context:** `chat-popup.component.ts:62` includes `<chat-launcher-button (click)="toggle()" />` in its template, alongside the `<chat>` composition inside the popup window. The `chat-sidebar` composition omits this entirely — there's no launcher in the DOM at all on `/sidebar`. The fix mirrors popup's pattern: add the import, register in the `imports` array, render in the template.

The existing `toggle()` method on `ChatSidebarComponent` (line 82) flips the `open` model — exactly what the new launcher needs. The chat-launcher-button styles already position the button at `bottom: 20px; right: 20px` (the canonical user-facing position; debug is now out of the way after Task 1).

---

- [ ] **Step 1: Write the failing test**

Open `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts`. After the existing `describe('ChatSidebarComponent', () => { ... })` block's tests, add a new test (inside the same `describe`):

```ts
  it('renders a chat-launcher-button', () => {
    const fixture = TestBed.createComponent(ChatSidebarComponent);
    fixture.componentRef.setInput('agent', {
      messages: () => [],
      isLoading: () => false,
      status: () => 'idle',
      submit: () => Promise.resolve(),
      reset: () => undefined,
    });
    fixture.detectChanges();
    const launcher = fixture.nativeElement.querySelector('.chat-launcher-button');
    expect(launcher).not.toBeNull();
  });
```

The minimal agent stub is enough to satisfy `agent = input.required<Agent>()` — the rest of the component doesn't run during a single `detectChanges` if the panel isn't opened. If TypeScript complains about `setInput` arg types, cast: `fixture.componentRef.setInput('agent', stub as never)`.

- [ ] **Step 2: Run to verify failure**

```
cd libs/chat && npx vitest run src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts
```

Expected: FAIL — `expected null not to be null` on the launcher query (the button isn't rendered today).

- [ ] **Step 3: Add the launcher to the component**

Open `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts`. Locate the existing imports near the top:

```ts
import { ChatComponent } from '../chat/chat.component';
```

Immediately after that line, add:

```ts
import { ChatLauncherButtonComponent } from '../../primitives/chat-launcher-button/chat-launcher-button.component';
```

Locate the `@Component({ imports: [...] })` array (it currently includes `ChatComponent`). Add `ChatLauncherButtonComponent` to the array. The result should read like:

```ts
  imports: [ChatComponent, ChatLauncherButtonComponent],
```

(If the file uses a different formatting — multi-line array, alphabetized, etc. — follow the existing style.)

Now locate the template. The current template renders `<div class="chat-sidebar__content"><ng-content /></div>` followed by `<aside class="chat-sidebar__panel" ...>...</aside>`. The launcher belongs as a sibling of those — typically positioned before the `<aside>`. Add the line:

```html
    <chat-launcher-button (click)="toggle()" />
```

inside the template literal, BEFORE the `<aside ...>` element, AFTER the `<div class="chat-sidebar__content">` element. The exact placement matches `chat-popup.component.ts:60–62` for consistency.

- [ ] **Step 4: Run the test to confirm pass**

```
cd libs/chat && npx vitest run src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts
```

Expected: PASS — the new test green plus all existing chat-sidebar tests still green.

- [ ] **Step 5: Run the full chat suite for regression check**

```
cd libs/chat && npx vitest run
```

Expected: all chat specs pass.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts \
        libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts
git commit -m "fix(chat-sidebar): add missing chat-launcher-button

chat-popup renders a chat-launcher-button to toggle its window
(line 62), but chat-sidebar omitted this entirely — no import, no
template entry. Users hitting /sidebar mode saw an empty page with
copy promising 'click the launcher button (right edge)' but no
button was in the DOM.

Mirror the popup pattern: import ChatLauncherButtonComponent, add
to imports[], render <chat-launcher-button (click)=\"toggle()\" />
adjacent to the sliding panel. toggle() already exists on the
component (line 82).

Adds one spec assertion: the launcher is in the rendered DOM.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Build the smoke app + open PR

**Files:** None modified.

**Context:** Production verification happens after merge against `demo.cacheplane.ai`. Pre-PR, we sanity-check the smoke app builds cleanly with the changes.

---

- [ ] **Step 1: Build the smoke app**

```
npx nx build examples-chat-angular --configuration=production
```

Expected: succeeds. No TypeScript errors. The changes are isolated to library files but Angular re-typechecks consumers transitively, so this catches any breakage.

- [ ] **Step 2: Run the chat suite once more**

```
cd libs/chat && npx vitest run
```

Expected: all green.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin claude/chat-debug-bottom-left
gh pr create --title "fix(chat): debug toggle to bottom-left + missing sidebar launcher" --body "$(cat <<'EOF'
## Summary

Two UI bugs found via browser smoke against the freshly-deployed
\`demo.cacheplane.ai\`:

1. **Popup launcher occluded by debug toggle.** Both rendered at
   \`position: fixed; bottom: 20px; right: 20px\` — debug won because
   it has \`z-index: 990\` and renders later in the DOM. Clicks at
   that corner hit debug, not the chat launcher.

2. **Sidebar launcher missing entirely.** \`chat-popup\` includes
   \`<chat-launcher-button (click)=\"toggle()\" />\` in its template;
   \`chat-sidebar\` doesn't import or render the launcher at all.
   Empty-state text on \`/sidebar\` promises a button that isn't
   in the DOM.

## Fix

- Move \`chat-debug\`'s \`.launcher\` pill from \`right: 20px\` to
  \`left: 20px\`. One-line CSS change. Frees up the canonical bottom-
  right slot for user-facing chat launchers across all consumers.
- Add \`<chat-launcher-button>\` to \`chat-sidebar\`'s template,
  matching the popup pattern. One new spec assertion locks it in.

## Spec & Plan

- \`docs/superpowers/specs/2026-05-13-chat-debug-launcher-left-design.md\`
- \`docs/superpowers/plans/2026-05-13-chat-debug-launcher-left.md\`

## Test plan

- [x] Existing chat suite passes (regression check)
- [x] New chat-sidebar test: launcher button is rendered
- [x] Production build of \`examples-chat-angular\` succeeds
- [ ] After merge, browser smoke against \`demo.cacheplane.ai\`:
  - [ ] \`/embed\` — debug pill is at bottom-left, no overlap, chat works
  - [ ] \`/popup\` — click bottom-right launcher → popup window opens
  - [ ] \`/sidebar\` — click bottom-right launcher → sidebar slides in
  - [ ] Debug panel dock controls (right/left/bottom) all still work

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for CI green, merge**

Required CI checks before merge (the standard set on this repo): \`Library — lint / test / build\`, \`Website — lint / build\`, \`Cockpit — build / test\`, \`Cockpit — e2e\`, \`Cockpit — representative capability smoke\`, \`Cockpit — build all examples\`, \`Cockpit — deploy smoke dry-run\`, \`Cockpit — secret-gated integration\`, \`Website — e2e\`, \`examples/chat — python smoke\`.

When all green, merge via squash:

```bash
gh pr merge <PR_NUMBER> --squash
```

Then clean up the worktree + branch.

- [ ] **Step 5: Post-merge browser smoke**

Open \`https://demo.cacheplane.ai\` once the post-merge deploy completes (~5 min after merge). Walk through the four manual checks from the PR test plan. If any fail, file a follow-up.

---

## Self-review notes

- **Spec coverage:** each spec section maps to a task. Architecture → Tasks 1 + 2. "Components touched" table → Tasks 1 + 2 file lists. Testing (unit) → Task 2 Step 1. Testing (manual) → Task 3 Step 5. Out-of-scope items remain out of scope.
- **No placeholders:** every step has final code or commands. The agent stub in Task 2 Step 1 is concrete enough for the test to pass.
- **Type consistency:** \`ChatLauncherButtonComponent\`, \`<chat-launcher-button>\` selector, \`toggle()\` method — all spelled identically across Task 2's steps and the existing popup precedent.
- **Risk:** the agent-stub shape (Task 2 Step 1) — if Angular complains about missing methods on the stub, cast to \`as never\` and move on. The component doesn't exercise those methods during the synchronous `detectChanges` pass that the test uses.
