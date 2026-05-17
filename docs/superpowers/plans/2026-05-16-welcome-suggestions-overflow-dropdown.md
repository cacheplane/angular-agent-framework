# Welcome suggestions — top-3 + overflow dropdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the canonical demo's welcome state from 17 stacked suggestion chips to 3 curated chips + a "More prompts" dropdown that surfaces the remaining 14.

**Architecture:** Demo-side only. Split the existing flat `WELCOME_SUGGESTIONS` const into `FEATURED_SUGGESTIONS` (the curated 3) + `MORE_SUGGESTIONS` (the other 14). New tiny standalone component `WelcomeSuggestionsComponent` composes `<chat-welcome-suggestion>` × 3 (existing chip primitive) + `<chat-select>` × 1 (existing dropdown primitive used by the model picker). Three mode components (embed/popup/sidebar) swap their `@for` block for a single `<welcome-suggestions>` element.

**Tech Stack:** Angular 20+ signals, standalone components, vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-16-welcome-suggestions-overflow-dropdown-design.md`

**Branch:** `claude/welcome-suggestions-overflow-dropdown` (already checked out; spec committed at `33697dc6`).

---

## File Structure

**Create:**
- `examples/chat/angular/src/app/modes/welcome-suggestions.component.ts` — the composer
- `examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts` — its vitest spec

**Modify:**
- `examples/chat/angular/src/app/modes/welcome-suggestions.ts` — split flat const into FEATURED + MORE; keep `WELCOME_SUGGESTIONS` re-export for back-compat
- `examples/chat/angular/src/app/modes/embed-mode.component.ts` — swap `@for` block for `<welcome-suggestions>`
- `examples/chat/angular/src/app/modes/popup-mode.component.ts` — same swap
- `examples/chat/angular/src/app/modes/sidebar-mode.component.ts` — same swap

**Conventions used across all tasks:**
- `WelcomeSuggestion` interface: `{ label: string; value: string }` (already exists)
- `ChatSelectOption` interface from `@ngaf/chat`: `{ value: string; label: string; disabled?: boolean }`
- Component selector: `welcome-suggestions` (no prefix — demo-internal)
- Output: `selected = output<string>()` emitting the suggestion's `value`
- Mode components use `chatWelcomeSuggestions` directive selector on a wrapping element to slot into chat-window's welcome state (existing pattern, kept)

---

## Task 1: Split WELCOME_SUGGESTIONS into FEATURED + MORE

**Files:**
- Modify: `examples/chat/angular/src/app/modes/welcome-suggestions.ts`

- [ ] **Step 1: Replace the file contents**

Open `examples/chat/angular/src/app/modes/welcome-suggestions.ts` and replace the entire file with:

```ts
// SPDX-License-Identifier: MIT

/**
 * Welcome suggestion prompts shown in each mode's empty state. Kept in
 * one file so all three modes ship the same list — and so adding a
 * suggestion (e.g. one that exercises tables, code blocks, etc.) is a
 * single-file change.
 *
 * Two-tier surface:
 *   - FEATURED_SUGGESTIONS — 3 curated prompts shown as chips above the
 *     fold. Each picks a distinct capability path so a first-time
 *     visitor sees breadth in one glance: markdown streaming, tool use
 *     with citations, and a GenUI surface render.
 *   - MORE_SUGGESTIONS — the remaining 14 prompts, surfaced behind a
 *     "More prompts" dropdown rendered by WelcomeSuggestionsComponent.
 *
 * The flat WELCOME_SUGGESTIONS export remains for any consumer that
 * imports it (none in-tree today; preserved for back-compat).
 */
export interface WelcomeSuggestion {
  readonly label: string;
  readonly value: string;
}

export const FEATURED_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  // 1. Markdown / streaming showcase
  { label: 'Tell me about coral reefs', value: 'Tell me about coral reefs' },

  // 2. Tool use + citations
  {
    label: 'What are Angular signals? (search + cite sources)',
    value:
      'Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite each source inline as [^doc-id] using the document `id` field returned by the tool.',
  },

  // 3. GenUI surface render
  {
    label: 'Demo: render a contact form',
    value:
      'Show me a contact form with fields for name, email address, subject, and a multi-line message, plus a Send button.',
  },
];

export const MORE_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  { label: 'Write a haiku about Angular', value: 'Write a haiku about Angular' },
  { label: 'List 5 productivity tips', value: 'List 5 productivity tips, in markdown bullets.' },
  {
    label: 'Compare Angular signals, RxJS, and zone.js',
    value:
      'Show me a table comparing Angular signals, RxJS, and zone.js — three columns: name, mental model, when to use.',
  },
  {
    label: 'Explain promises with code',
    value: 'Explain JavaScript promises with a fenced code block in TypeScript.',
  },
  {
    label: 'Solve a multi-step puzzle (try Effort = high)',
    value:
      'Three friends start with 14 apples. They share them so each gets a different prime number of apples and one gets exactly twice as many as another. How many does each get? Walk through your reasoning step by step.',
  },
  {
    label: 'Demo: ask for approval before a sensitive action',
    value:
      'I want to clean up old database backups older than 90 days. Walk me through what you would delete, and call request_approval before doing anything destructive so I can review your plan.',
  },
  {
    label: 'Demo: dispatch a research subagent',
    value:
      'Use the research subagent to investigate the history and motivation behind Angular standalone components, then report back with a concise summary.',
  },
  {
    label: 'Demo: render a feedback form',
    value:
      'Build me an interactive feedback form with a name field, a 1–5 rating picker, and a Submit button.',
  },
  {
    label: 'Demo: render a settings card',
    value:
      'Render a settings card with a toggle for dark mode, a language dropdown (English / Spanish / French), and a Save button.',
  },
  {
    label: 'Demo: render a poll',
    value:
      'Create a quick poll asking "Which front-end framework do you prefer?" with options Angular, React, Vue, and Svelte, plus a Vote button.',
  },
  {
    label: 'Demo: render a media-rich product card',
    value:
      'Render a product card with: a header image at the top, a tab strip with two tabs ("Overview" and "Specs"). Under Overview show a Row containing an icon and a short description Text. Under Specs show a List of feature bullets each prefixed with a small icon. Below the tabs add a primary "Add to cart" Button.',
  },
  {
    label: 'Demo: render a booking surface with modal',
    value:
      'Render a booking surface: a heading "Book your trip", a DateTimeInput for travel date, a horizontal divider, then a Row containing two Cards (one for departure city, one for return city) each with a TextField. Below the Row add a primary "Continue" Button whose action opens a Modal containing a confirmation Column with a summary Text and Confirm / Cancel Buttons.',
  },
  {
    label: 'Smoke: media + layout kitchen sink',
    value:
      'Render a Card containing a Tabs component with two tabs labeled "Media" and "Layout". Under the Media tab show a Column containing: a header Image (use https://placehold.co/600x300/4f8df5/ffffff.png as the URL), an Icon (any icon name from the canonical set, e.g. star), a short Text caption, an AudioPlayer (use https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3 as the URL), and a Video (use https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4 as the URL). Under the Layout tab show: a Row containing two Text components separated by a vertical Divider, then a horizontal Divider, then a List of three Text bullet items, then a Column containing two Text components.',
  },
  {
    label: 'Smoke: interactive form kitchen sink',
    value:
      'Render a Card titled "Profile setup" containing a Column with: a TextField for display name, a Slider for "experience years" (range 0-30), a CheckBox for "subscribe to newsletter", a DateTimeInput for birthday (date only), a MultipleChoice for "favorite frameworks" with options Angular, React, Vue, Svelte and maxAllowedSelections of 3 (multi-select), a horizontal Divider, a Row containing a primary "Save" Button and a secondary "Open details" Button whose action opens a Modal with a Column containing a Text summary and a Close Button.',
  },
];

/**
 * Back-compat: unified array combining featured + more in the original
 * order. Kept so existing imports don't break. Prefer FEATURED_SUGGESTIONS
 * + MORE_SUGGESTIONS for the two-tier UI.
 */
export const WELCOME_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  ...FEATURED_SUGGESTIONS,
  ...MORE_SUGGESTIONS,
];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from repo root:

```bash
npx nx build examples-chat-angular
```

Expected: build succeeds. The three mode components still reference `WELCOME_SUGGESTIONS` (the back-compat export still exists) so nothing breaks yet.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/modes/welcome-suggestions.ts
git commit -m "refactor(examples-chat): split WELCOME_SUGGESTIONS into FEATURED + MORE

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create WelcomeSuggestionsComponent + spec

**Files:**
- Create: `examples/chat/angular/src/app/modes/welcome-suggestions.component.ts`
- Create: `examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts`

- [ ] **Step 1: Write the failing spec**

Create `examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WelcomeSuggestionsComponent } from './welcome-suggestions.component';
import { FEATURED_SUGGESTIONS, MORE_SUGGESTIONS } from './welcome-suggestions';

describe('WelcomeSuggestionsComponent', () => {
  let fx: ComponentFixture<WelcomeSuggestionsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [WelcomeSuggestionsComponent] });
    fx = TestBed.createComponent(WelcomeSuggestionsComponent);
    fx.detectChanges();
  });

  it('renders one chip per FEATURED_SUGGESTIONS entry', () => {
    const chips = fx.nativeElement.querySelectorAll('chat-welcome-suggestion');
    expect(chips.length).toBe(FEATURED_SUGGESTIONS.length);
    expect(FEATURED_SUGGESTIONS.length).toBe(3);
  });

  it('renders the chip labels in order', () => {
    const labels = Array.from(
      fx.nativeElement.querySelectorAll('chat-welcome-suggestion .chat-welcome-suggestion__label'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(labels).toEqual(FEATURED_SUGGESTIONS.map((s) => s.label));
  });

  it('renders the overflow chat-select with "More prompts" placeholder', () => {
    const select = fx.nativeElement.querySelector('chat-select');
    expect(select).toBeTruthy();
    const trigger = select.querySelector('.chat-select__trigger') as HTMLElement;
    expect(trigger.textContent).toContain('More prompts');
  });

  it('passes MORE_SUGGESTIONS through as chat-select options', () => {
    const opts = fx.componentInstance['moreOptions'] as { value: string; label: string }[];
    expect(opts.length).toBe(MORE_SUGGESTIONS.length);
    expect(opts.length).toBe(14);
    expect(opts[0].label).toBe(MORE_SUGGESTIONS[0].label);
    expect(opts[0].value).toBe(MORE_SUGGESTIONS[0].value);
  });

  it('emits (selected) when a chip is clicked', () => {
    let captured: string | null = null;
    fx.componentInstance.selected.subscribe((v) => (captured = v));
    const firstChipBtn = fx.nativeElement.querySelector('chat-welcome-suggestion button') as HTMLButtonElement;
    firstChipBtn.click();
    expect(captured).toBe(FEATURED_SUGGESTIONS[0].value);
  });
});
```

- [ ] **Step 2: Run the spec to confirm it fails**

Run from `libs/chat` parent (since vitest config is workspace-level):

```bash
cd examples/chat/angular && ../../../node_modules/.bin/vitest run src/app/modes/welcome-suggestions.component.spec.ts
```

Expected: 5 failures, all citing `WelcomeSuggestionsComponent` not found.

- [ ] **Step 3: Implement the component**

Create `examples/chat/angular/src/app/modes/welcome-suggestions.component.ts`:

```ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import {
  ChatWelcomeSuggestionComponent,
  ChatSelectComponent,
  type ChatSelectOption,
} from '@ngaf/chat';
import { FEATURED_SUGGESTIONS, MORE_SUGGESTIONS } from './welcome-suggestions';

/**
 * Demo-side composition that renders the welcome-state suggestion surface
 * as 3 curated chips above + a "More prompts" dropdown below for the
 * remaining demo prompts. Reuses `<chat-welcome-suggestion>` (chip) and
 * `<chat-select>` (the same primitive backing the model picker pill).
 *
 * Output `(selected)` fires with the suggestion's `value` for BOTH chip
 * clicks and dropdown picks — consumers wire it directly to
 * `agent.submit({ message: $event })` for auto-send semantics.
 */
@Component({
  selector: 'welcome-suggestions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatWelcomeSuggestionComponent, ChatSelectComponent],
  template: `
    <div class="welcome-suggestions__featured">
      @for (s of featured; track s.value) {
        <chat-welcome-suggestion
          [label]="s.label"
          [value]="s.value"
          (selected)="selected.emit($event)"
        />
      }
    </div>
    <div class="welcome-suggestions__overflow">
      <chat-select
        [options]="moreOptions"
        placeholder="More prompts"
        menuLabel="More demo prompts"
        (valueChange)="selected.emit($event)"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .welcome-suggestions__featured {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
      }
    `,
  ],
})
export class WelcomeSuggestionsComponent {
  readonly selected = output<string>();
  protected readonly featured = FEATURED_SUGGESTIONS;
  protected readonly moreOptions: readonly ChatSelectOption[] = MORE_SUGGESTIONS.map(
    (s) => ({ value: s.value, label: s.label }),
  );
}
```

- [ ] **Step 4: Run the spec to confirm it passes**

```bash
cd examples/chat/angular && ../../../node_modules/.bin/vitest run src/app/modes/welcome-suggestions.component.spec.ts
```

Expected: 5/5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/modes/welcome-suggestions.component.ts \
        examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts
git commit -m "feat(examples-chat): WelcomeSuggestionsComponent — 3 chips + overflow dropdown

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Migrate embed-mode to use the new component

**Files:**
- Modify: `examples/chat/angular/src/app/modes/embed-mode.component.ts`

- [ ] **Step 1: Make the edits**

Replace the import statement on line 3:

```ts
// BEFORE
import { ChatComponent, ChatWelcomeSuggestionComponent, a2uiBasicCatalog } from '@ngaf/chat';

// AFTER
import { ChatComponent, a2uiBasicCatalog } from '@ngaf/chat';
```

Replace the line importing `WELCOME_SUGGESTIONS`:

```ts
// BEFORE
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';

// AFTER
import { WelcomeSuggestionsComponent } from './welcome-suggestions.component';
```

Update the `imports` array in the `@Component` decorator:

```ts
// BEFORE
imports: [ChatComponent, ChatWelcomeSuggestionComponent],

// AFTER
imports: [ChatComponent, WelcomeSuggestionsComponent],
```

Replace the `@for` block in the template:

```ts
// BEFORE
<div chatWelcomeSuggestions>
  @for (s of suggestions; track s.value) {
    <chat-welcome-suggestion
      [label]="s.label"
      [value]="s.value"
      (selected)="send($event)"
    />
  }
</div>

// AFTER
<welcome-suggestions chatWelcomeSuggestions (selected)="send($event)" />
```

Delete the now-unused `suggestions` field on the class:

```ts
// BEFORE
export class EmbedMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly shell = inject(DemoShell);
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  // …rest unchanged

// AFTER
export class EmbedMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly shell = inject(DemoShell);
  // …rest unchanged
```

- [ ] **Step 2: Verify the build**

```bash
npx nx build examples-chat-angular
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/modes/embed-mode.component.ts
git commit -m "refactor(examples-chat): embed-mode uses WelcomeSuggestionsComponent

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Migrate popup-mode to use the new component

**Files:**
- Modify: `examples/chat/angular/src/app/modes/popup-mode.component.ts`

Same change shape as Task 3, applied to popup-mode.

- [ ] **Step 1: Make the edits**

In `examples/chat/angular/src/app/modes/popup-mode.component.ts`:

(a) The import that currently reads:

```ts
import { ChatPopupComponent, ChatWelcomeSuggestionComponent, a2uiBasicCatalog } from '@ngaf/chat';
```

Change to:

```ts
import { ChatPopupComponent, a2uiBasicCatalog } from '@ngaf/chat';
```

(b) The import:

```ts
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';
```

Change to:

```ts
import { WelcomeSuggestionsComponent } from './welcome-suggestions.component';
```

(c) The `@Component` `imports` array entry `ChatWelcomeSuggestionComponent` → `WelcomeSuggestionsComponent`.

(d) The template's `@for` block:

```html
<div chatWelcomeSuggestions>
  @for (s of suggestions; track s.value) {
    <chat-welcome-suggestion
      [label]="s.label"
      [value]="s.value"
      (selected)="send($event)"
    />
  }
</div>
```

Replace with:

```html
<welcome-suggestions chatWelcomeSuggestions (selected)="send($event)" />
```

(e) Delete the `suggestions` field on the class:

```ts
protected readonly suggestions = WELCOME_SUGGESTIONS;
```

- [ ] **Step 2: Verify the build**

```bash
npx nx build examples-chat-angular
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/modes/popup-mode.component.ts
git commit -m "refactor(examples-chat): popup-mode uses WelcomeSuggestionsComponent

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Migrate sidebar-mode to use the new component

**Files:**
- Modify: `examples/chat/angular/src/app/modes/sidebar-mode.component.ts`

Same change shape as Tasks 3 and 4, applied to sidebar-mode.

- [ ] **Step 1: Make the edits**

In `examples/chat/angular/src/app/modes/sidebar-mode.component.ts`:

(a) The import that currently reads:

```ts
import { ChatSidebarComponent, ChatWelcomeSuggestionComponent, a2uiBasicCatalog } from '@ngaf/chat';
```

Change to:

```ts
import { ChatSidebarComponent, a2uiBasicCatalog } from '@ngaf/chat';
```

(b) The import:

```ts
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';
```

Change to:

```ts
import { WelcomeSuggestionsComponent } from './welcome-suggestions.component';
```

(c) The `@Component` `imports` array entry `ChatWelcomeSuggestionComponent` → `WelcomeSuggestionsComponent`.

(d) The template's `@for` block:

```html
<div chatWelcomeSuggestions>
  @for (s of suggestions; track s.value) {
    <chat-welcome-suggestion
      [label]="s.label"
      [value]="s.value"
      (selected)="send($event)"
    />
  }
</div>
```

Replace with:

```html
<welcome-suggestions chatWelcomeSuggestions (selected)="send($event)" />
```

(e) Delete the `suggestions` field on the class:

```ts
protected readonly suggestions = WELCOME_SUGGESTIONS;
```

- [ ] **Step 2: Verify the build**

```bash
npx nx build examples-chat-angular
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/modes/sidebar-mode.component.ts
git commit -m "refactor(examples-chat): sidebar-mode uses WelcomeSuggestionsComponent

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Build verify, lint, push, open PR

**Files:** none modified — gate task.

- [ ] **Step 1: Full build + lint for the demo app**

```bash
npx nx run-many -t build,lint -p examples-chat-angular
```

Expected: both targets pass.

- [ ] **Step 2: Run the new vitest spec one more time + the full examples-chat-angular suite**

```bash
cd examples/chat/angular && ../../../node_modules/.bin/vitest run
```

Expected: all tests pass. The new `welcome-suggestions.component.spec.ts` adds 5 cases.

- [ ] **Step 3: Sanity grep — no orphan `ChatWelcomeSuggestionComponent` refs in demo**

```bash
grep -rn "ChatWelcomeSuggestionComponent" examples/chat/angular/src/
```

Expected: zero matches. The 3 mode components used to import it; now they import `WelcomeSuggestionsComponent` instead.

- [ ] **Step 4: Sanity grep — no orphan `WELCOME_SUGGESTIONS` refs in mode components**

```bash
grep -rn "WELCOME_SUGGESTIONS" examples/chat/angular/src/app/modes/
```

Expected: exactly 1 match — the export inside `welcome-suggestions.ts` itself. The 3 mode components no longer import the unified flat list.

- [ ] **Step 5: Sanity grep — every mode component now imports the new composer**

```bash
grep -rn "WelcomeSuggestionsComponent" examples/chat/angular/src/app/modes/
```

Expected: 4 matches — 1 declaration in `welcome-suggestions.component.ts`, 3 imports in the mode components.

- [ ] **Step 6: Confirm commits on branch**

```bash
git log --oneline origin/main..HEAD
```

Expected output (in order, top is most recent):

```
<sha> refactor(examples-chat): sidebar-mode uses WelcomeSuggestionsComponent
<sha> refactor(examples-chat): popup-mode uses WelcomeSuggestionsComponent
<sha> refactor(examples-chat): embed-mode uses WelcomeSuggestionsComponent
<sha> feat(examples-chat): WelcomeSuggestionsComponent — 3 chips + overflow dropdown
<sha> refactor(examples-chat): split WELCOME_SUGGESTIONS into FEATURED + MORE
<sha> docs: spec for welcome-suggestions top-3 + overflow dropdown
```

- [ ] **Step 7: Push the branch**

```bash
git push -u origin claude/welcome-suggestions-overflow-dropdown
```

- [ ] **Step 8: Open PR**

```bash
gh pr create --head claude/welcome-suggestions-overflow-dropdown --title "feat(examples-chat): welcome suggestions — 3 chips + overflow dropdown" --body "$(cat <<'EOF'
## Summary

Reduces the canonical demo's welcome state from 17 stacked suggestion chips to **3 curated chips + 1 "More prompts" dropdown**. Each chip in the trio exercises a distinct capability path: markdown streaming, tool use with citations, and a GenUI surface render. The dropdown uses the same \`chat-select\` primitive the model picker uses, so it visually matches.

## Why

The previous welcome state occupied ~360px of vertical space and put 17 prompts on equal footing. A first-time visitor at https://demo.cacheplane.ai/embed saw a wall of options instead of a focused experience.

## How

Pure demo-side composition. Splits the flat \`WELCOME_SUGGESTIONS\` const into:
- \`FEATURED_SUGGESTIONS\` — the curated 3
- \`MORE_SUGGESTIONS\` — the remaining 14

Adds \`WelcomeSuggestionsComponent\` (\`examples/chat/angular/src/app/modes/\`) that composes \`<chat-welcome-suggestion>\` × 3 + \`<chat-select>\` × 1. The 3 mode components (embed/popup/sidebar) each replace their \`@for\` block with a single \`<welcome-suggestions>\` element.

No \`@ngaf/chat\` API changes; no release needed.

## Behavior

- Click a chip → first message sent (auto-send, unchanged from before)
- Pick from dropdown → same auto-send path
- Click outside dropdown → popover closes, welcome state unchanged

## Test plan
- [x] 5 new vitest cases in \`welcome-suggestions.component.spec.ts\` cover: chip count, chip labels, dropdown placeholder, options array shape, click emits (selected)
- [x] \`npx nx build examples-chat-angular\` green
- [x] \`npx nx lint examples-chat-angular\` green
- [x] Grep sanity: no orphan \`ChatWelcomeSuggestionComponent\` / \`WELCOME_SUGGESTIONS\` imports in mode components
- [ ] CI green
- [ ] Post-deploy: demo.cacheplane.ai shows 3 chips + dropdown

Spec: \`docs/superpowers/specs/2026-05-16-welcome-suggestions-overflow-dropdown-design.md\`
Plan: \`docs/superpowers/plans/2026-05-16-welcome-suggestions-overflow-dropdown.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 9: Watch CI, merge on green**

```bash
gh pr checks <PR_NUMBER>
# When all required checks pass:
gh pr merge <PR_NUMBER> --squash --delete-branch
```

After merge, the next main CI run's `Deploy → Vercel` job will pick up the change (the diff touches `examples/chat/angular/`, which sets `demo_changed=true`) and redeploy demo.cacheplane.ai automatically.

---

## Notes for the executing engineer

- **The new component is demo-internal.** It uses the selector `welcome-suggestions` (no prefix) on purpose — this is not part of `@ngaf/chat`'s public API. If a second consumer of @ngaf/chat ever needs this pattern, promote it then.
- **`chatWelcomeSuggestions` directive stays.** The existing chat composition (`<chat>`, `<chat-popup>`, `<chat-sidebar>`) uses a `chatWelcomeSuggestions` directive selector to project content into the welcome state. The new component is rendered AS the projected content, so the `chatWelcomeSuggestions` attribute moves from a wrapping `<div>` to the new `<welcome-suggestions>` element directly.
- **Auto-send semantics.** Both chip clicks and dropdown picks emit `(selected)` with the suggestion's `value`. The mode components route that to `send($event)` which calls `agent.submit({ message: $event })` — identical to the previous chip behavior.
- **`chat-select` retains selected state internally.** When the user picks from the dropdown, `chat-select` writes the value to its internal `value = model<string>('')` signal. This is invisible because the welcome state unmounts on first submit — but it means if you ever wanted to re-show the same dropdown after a send, you'd need to reset its value. Not relevant today.
