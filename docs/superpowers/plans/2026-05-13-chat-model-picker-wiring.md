# Chat Model Picker Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the `<chat>` composition's existing model picker (a `chat-select` already wired into the `[chatInputModelSelect]` slot when `[modelOptions]` is non-empty) in the smoke test app's three mode components.

**Architecture:** No new primitive. The `<chat>` composition (in `libs/chat`) already exposes `[modelOptions]` and `[(selectedModel)]` inputs. Each smoke-app mode component (`embed-mode`, `popup-mode`, `sidebar-mode`) currently uses `<chat>` without those inputs, so the pill never renders. Wire each mode to pass them through from the demo shell's existing `model` signal and `modelOptions` signal. ~10 lines of code across 4 files (3 mode templates + 1 visibility change on `DemoShell.modelOptions`).

**Tech Stack:** Angular 21 standalone components, signal two-way binding (`model()` → `[(selectedModel)]`), no test changes (the `chat-select` primitive is already covered upstream).

---

## Background (why this changed)

An earlier draft of this work created a new `ChatModelPickerComponent` primitive. That was redundant: `libs/chat/src/lib/primitives/chat-select/chat-select.component.ts` already implements the same UX (pill trigger + popover listbox, keyboard nav, outside-click), and `chat/composition` projects it into the `chatInputModelSelect` slot whenever `[modelOptions]` is set. The actual missing work is consumer wiring, not framework primitive work. The earlier commits were reset.

---

### Task 1: Make `DemoShell.modelOptions` public + wire the three modes

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts:244` (visibility of `modelOptions`)
- Modify: `examples/chat/angular/src/app/modes/embed-mode.component.ts` (template)
- Modify: `examples/chat/angular/src/app/modes/popup-mode.component.ts` (template)
- Modify: `examples/chat/angular/src/app/modes/sidebar-mode.component.ts` (template)

**Context:**

`DemoShell.model` is already `readonly` (public) so modes access it via `shell.model`. `DemoShell.modelOptions` is currently `protected readonly`, which blocks template access from the mode components. Drop the `protected` qualifier (mirror the visibility of `model`).

The `<chat>` composition's contract:
- `[modelOptions]: readonly ChatSelectOption[]` — pass a non-empty array to make the pill render.
- `[(selectedModel)]: string` — two-way binding; reads the current selection, writes when the user picks. This wires straight to `shell.model` (a `signal<string>`).

The existing `onModelChange` handler on `DemoShell` persists the value to localStorage and is invoked by the debug-panel dropdown via `(valueChange)`. The new pill writes the signal directly (via `[(selectedModel)]`), bypassing the handler — so persistence is lost on this code path. Fix by using an effect or by switching the wiring to one-way + (selectedModelChange). For YAGNI, do the simpler form: `[selectedModel]="shell.model()"` + `(selectedModelChange)="shell.onModelChange($event)"`.

---

- [ ] **Step 1: Make `modelOptions` public on `DemoShell`**

In `examples/chat/angular/src/app/shell/demo-shell.component.ts` around line 244, change:

```ts
  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
```

to:

```ts
  readonly modelOptions = signal<readonly { value: string; label: string }[]>([
```

(Single keyword removal. Confirm no other references to `modelOptions` need updating — the existing debug-panel template binding `[options]="modelOptions()"` still works from inside the class.)

- [ ] **Step 2: Wire `embed-mode.component.ts`**

In `examples/chat/angular/src/app/modes/embed-mode.component.ts`, find the `<chat>` opening tag (currently line 14-19):

```html
    <chat
      [agent]="agent"
      [views]="catalog"
      (replayRequested)="shell.onTimelineReplay($event)"
      (forkRequested)="shell.onTimelineFork($event)"
    >
```

Replace with:

```html
    <chat
      [agent]="agent"
      [views]="catalog"
      [modelOptions]="shell.modelOptions()"
      [selectedModel]="shell.model()"
      (selectedModelChange)="shell.onModelChange($event)"
      (replayRequested)="shell.onTimelineReplay($event)"
      (forkRequested)="shell.onTimelineFork($event)"
    >
```

- [ ] **Step 3: Wire `popup-mode.component.ts`**

In `examples/chat/angular/src/app/modes/popup-mode.component.ts`, find the `<chat>` opening tag and apply the same three new attributes (`[modelOptions]`, `[selectedModel]`, `(selectedModelChange)`) as in Step 2.

- [ ] **Step 4: Wire `sidebar-mode.component.ts`**

In `examples/chat/angular/src/app/modes/sidebar-mode.component.ts`, find the `<chat>` opening tag and apply the same three new attributes as in Step 2.

- [ ] **Step 5: Build the smoke app to verify wiring**

```
npx nx build examples-chat-angular --configuration=development
```

Expected: build succeeds. No TypeScript errors. If `shell.modelOptions` is reported inaccessible, re-check Step 1.

- [ ] **Step 6: Run the chat test suite as a regression check**

```
cd libs/chat && npx vitest run
```

Expected: all chat specs pass. Nothing in `libs/chat` changed, so this should be a no-op pass.

- [ ] **Step 7: Manual smoke (if dev server available)**

If the implementer can run the dev server, perform this. Otherwise document the steps in the PR description for the reviewer.

1. Start the smoke app, open in the browser.
2. **Embed mode (default):** Verify the model pill appears bottom-left of the chat input. Pill label reads `gpt-5-mini` (the default).
3. Click the pill → popover listbox opens with `gpt-5`, `gpt-5-mini`, `gpt-5-nano`. Current value highlighted.
4. Pick `gpt-5`. Pill updates. Open the debug panel → `Agent → Model` dropdown shows `gpt-5` (sync verified).
5. Reload the page. The pill still reads `gpt-5` (persistence via `onModelChange` works).
6. Switch to **Popup mode** via debug panel → confirm pill is visible in popup chat input. Repeat selection.
7. Switch to **Sidebar mode** → confirm pill is visible there too.
8. Send a message in any mode — confirm the agent uses the selected model (Network tab: request body includes the chosen model).

- [ ] **Step 8: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/modes/embed-mode.component.ts \
        examples/chat/angular/src/app/modes/popup-mode.component.ts \
        examples/chat/angular/src/app/modes/sidebar-mode.component.ts
git commit -m "$(cat <<'EOF'
feat(examples-chat): expose model picker pill in all three modes

The <chat> composition already projects a chat-select into the
[chatInputModelSelect] slot when [modelOptions] is non-empty, but
the smoke app's mode components never passed it through. Wire each
mode to shell.modelOptions + shell.model with persistence via
shell.onModelChange.

Drop `protected` from DemoShell.modelOptions so mode templates can
read it; visibility now mirrors `model` (already public).

No new primitive — chat-select handles the UI.

EOF
)"
```

- [ ] **Step 9: Push and open PR**

```bash
git push -u origin claude/chat-model-picker
gh pr create --title "feat(examples-chat): expose model picker pill in all three modes" --body "$(cat <<'EOF'
## Summary

- Wires the existing chat-select model picker (already rendered by `<chat>` when `[modelOptions]` is non-empty) into the smoke app's `embed-mode`, `popup-mode`, and `sidebar-mode`.
- Pill reads `shell.model()` and writes back via `(selectedModelChange) → shell.onModelChange()` so localStorage persistence keeps working.
- Drops the `protected` qualifier on `DemoShell.modelOptions` so mode templates can read it.

No new framework primitive — the underlying `chat-select` is already shipped.

## Plan

- `docs/superpowers/plans/2026-05-13-chat-model-picker-wiring.md`

## Test plan

- [x] Library tests pass (no `libs/chat` changes)
- [x] Smoke app builds
- [ ] Manual:
  - [ ] Embed mode: pill visible bottom-left, opens, selects, syncs with debug-panel dropdown, persists across reload
  - [ ] Popup mode: same
  - [ ] Sidebar mode: same
  - [ ] Submitting a message uses the selected model
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** the work was reduced to consumer wiring; the (previously written) spec document is deliberately not re-saved — its content is now misleading. Plan documents the actual ~10-line change with full code.
- **No placeholders:** every code block is final content.
- **Type consistency:** `modelOptions()` returns `readonly { value: string; label: string }[]` which satisfies `ChatSelectOption[]` (compatible structural typing — verify with the build step).
- **Persistence:** explicitly wired via `(selectedModelChange)="shell.onModelChange($event)"` rather than `[(selectedModel)]="shell.model"` because the existing `onModelChange` handler writes to localStorage, and the two-way binding form would bypass it.
