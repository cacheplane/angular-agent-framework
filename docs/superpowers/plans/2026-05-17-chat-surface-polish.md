# Chat-Surface Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship sub-project B of the demo UX polish pass — collapse welcome suggestions to a single featured chip + dropdown, add a scroll-fade above the chat input, and increase chat-message-actions padding.

**Architecture:** Two demo-side changes (welcome-suggestions data reorder + component refactor) and two library-side changes (chat-window adds a `.chat-window__scroll-fade` overlay inside the footer slot; `chat-message-actions` bumps padding). Library changes ship as a patch release; demo picks up via the canonical Vercel deploy when libs/ or examples/chat/angular changes land on main.

**Tech Stack:** Angular 20+ standalone components / signals / `@for`, vitest, Nx, @ngaf/chat primitives (chat-window, chat-welcome-suggestion, chat-select, chat-message-actions).

**Branch:** `claude/chat-surface-polish` (already created; spec committed).

**Spec:** `docs/superpowers/specs/2026-05-17-chat-surface-polish-design.md`

---

## File map

| File | Change |
|---|---|
| `examples/chat/angular/src/app/modes/welcome-suggestions.ts` | Reorder `FEATURED_SUGGESTIONS` so the contact-form prompt is index 0 |
| `examples/chat/angular/src/app/modes/welcome-suggestions.component.ts` | Render `featured[0]` as a single chip; merge `featured[1..] ++ more` into the dropdown options |
| `examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts` | Update tests for single-chip + expanded dropdown |
| `libs/chat/src/lib/styles/chat-message-actions.styles.ts` | Increase padding to `16px 0 12px 0` |
| `libs/chat/src/lib/primitives/chat-window/chat-window.component.ts` | Add `<div class="chat-window__scroll-fade" aria-hidden="true">` as first child of `.chat-window__footer` |
| `libs/chat/src/lib/styles/chat-window.styles.ts` | Add `position: relative` to `.chat-window__footer`; add `.chat-window__scroll-fade` rule |
| `libs/chat/src/lib/primitives/chat-window/chat-window.component.spec.ts` | Add test asserting the fade element renders |
| `libs/chat/package.json` | Bump `version` 0.0.35 → 0.0.36 |

---

## Task 1: Reorder FEATURED_SUGGESTIONS so contact-form is first

**Files:**
- Modify: `examples/chat/angular/src/app/modes/welcome-suggestions.ts:25-42`

- [ ] **Step 1: Read current array order**

Run: `grep -n 'label:' examples/chat/angular/src/app/modes/welcome-suggestions.ts | head -6`
Expected output (snippet): coral reefs first, Angular signals second, contact form third.

- [ ] **Step 2: Reorder so contact form is index 0**

Replace the `FEATURED_SUGGESTIONS` literal (lines 25-42) with:

```ts
export const FEATURED_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  // 1. GenUI surface render — the canonical demo's most differentiating capability
  {
    label: 'Demo: render a contact form',
    value:
      'Show me a contact form with fields for name, email address, subject, and a multi-line message, plus a Send button.',
  },

  // 2. Markdown / streaming showcase
  { label: 'Tell me about coral reefs', value: 'Tell me about coral reefs' },

  // 3. Tool use + citations
  {
    label: 'What are Angular signals? (search + cite sources)',
    value:
      'Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite each source inline as [^doc-id] using the document `id` field returned by the tool.',
  },
];
```

- [ ] **Step 3: Run the existing tests to see them fail on label-order assertion**

Run: `pnpm nx test chat-angular-example -- --runTestsByPath examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts`
Expected: `renders the chip labels in order` test passes (it reads from `FEATURED_SUGGESTIONS.map(s => s.label)`, so it's still correct after the reorder); `emits (selected) when a chip is clicked` still passes (asserts `FEATURED_SUGGESTIONS[0].value`, which is now the contact-form value). All 5 tests should pass.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/src/app/modes/welcome-suggestions.ts
git commit -m "feat(demo): feature contact-form prompt at index 0 of FEATURED_SUGGESTIONS"
```

---

## Task 2: Render only the first featured chip + dropdown for the rest

**Files:**
- Modify: `examples/chat/angular/src/app/modes/welcome-suggestions.component.ts` (full rewrite of template + class)
- Modify: `examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts` (rewrite all tests)

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `welcome-suggestions.component.spec.ts` with:

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

  it('renders exactly one featured chip', () => {
    const chips = fx.nativeElement.querySelectorAll('chat-welcome-suggestion');
    expect(chips.length).toBe(1);
  });

  it('renders the first featured suggestion as the chip', () => {
    const label = fx.nativeElement.querySelector(
      'chat-welcome-suggestion .chat-welcome-suggestion__label',
    ) as HTMLElement;
    expect(label.textContent?.trim()).toBe(FEATURED_SUGGESTIONS[0].label);
  });

  it('renders the overflow chat-select with "More prompts" placeholder', () => {
    const select = fx.nativeElement.querySelector('chat-select');
    expect(select).toBeTruthy();
    const trigger = select.querySelector('.chat-select__trigger') as HTMLElement;
    expect(trigger.textContent).toContain('More prompts');
  });

  it('merges FEATURED_SUGGESTIONS[1..] + MORE_SUGGESTIONS into dropdown options', () => {
    const opts = fx.componentInstance['moreOptions'] as { value: string; label: string }[];
    const expectedLen = FEATURED_SUGGESTIONS.length - 1 + MORE_SUGGESTIONS.length;
    expect(opts.length).toBe(expectedLen);
    // First overflow entry should be FEATURED_SUGGESTIONS[1]
    expect(opts[0].label).toBe(FEATURED_SUGGESTIONS[1].label);
    expect(opts[0].value).toBe(FEATURED_SUGGESTIONS[1].value);
    // After the leftover featured items, MORE_SUGGESTIONS begins
    const moreStart = FEATURED_SUGGESTIONS.length - 1;
    expect(opts[moreStart].label).toBe(MORE_SUGGESTIONS[0].label);
  });

  it('emits (selected) with the featured value when the chip is clicked', () => {
    let captured: string | null = null;
    fx.componentInstance.selected.subscribe((v) => (captured = v));
    const chipBtn = fx.nativeElement.querySelector(
      'chat-welcome-suggestion button',
    ) as HTMLButtonElement;
    chipBtn.click();
    expect(captured).toBe(FEATURED_SUGGESTIONS[0].value);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm nx test chat-angular-example -- --runTestsByPath examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts`
Expected: `renders exactly one featured chip` FAILS (current component renders 3); `merges FEATURED_SUGGESTIONS[1..] + MORE_SUGGESTIONS` FAILS (current moreOptions length is 14, not 16).

- [ ] **Step 3: Refactor the component**

Replace the entire contents of `welcome-suggestions.component.ts` with:

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
 * as a single featured chip + a "More prompts" dropdown for everything
 * else. The featured chip is `FEATURED_SUGGESTIONS[0]` — consumer
 * controls which prompt is featured by ordering the array.
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
    <div class="welcome-suggestions__row">
      <chat-welcome-suggestion
        class="welcome-suggestions__featured"
        [label]="featuredOne.label"
        [value]="featuredOne.value"
        (selected)="selected.emit($event)"
      />
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
        justify-content: center;
      }
      .welcome-suggestions__row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .welcome-suggestions__featured {
        max-width: 380px;
        overflow: hidden;
      }
      .welcome-suggestions__featured ::ng-deep .chat-welcome-suggestion__label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class WelcomeSuggestionsComponent {
  readonly selected = output<string>();
  protected readonly featuredOne = FEATURED_SUGGESTIONS[0];
  protected readonly moreOptions: readonly ChatSelectOption[] = [
    ...FEATURED_SUGGESTIONS.slice(1),
    ...MORE_SUGGESTIONS,
  ].map((s) => ({ value: s.value, label: s.label }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm nx test chat-angular-example -- --runTestsByPath examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/modes/welcome-suggestions.component.ts \
        examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts
git commit -m "feat(demo): collapse welcome suggestions to single chip + dropdown"
```

---

## Task 3: Bump chat-message-actions padding to 16px / 12px

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-message-actions.styles.ts:10` (the `padding: 4px 0 0 0;` line on `:host`)

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/primitives/chat-message-actions/chat-message-actions.styles.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { CHAT_MESSAGE_ACTIONS_STYLES } from '../../styles/chat-message-actions.styles';

describe('CHAT_MESSAGE_ACTIONS_STYLES', () => {
  it('sets 16px top / 12px bottom padding on :host so the actions row has breathing room', () => {
    // Normalize whitespace so a multi-line CSS rule still matches.
    const normalized = CHAT_MESSAGE_ACTIONS_STYLES.replace(/\s+/g, ' ');
    expect(normalized).toMatch(/:host\s*\{[^}]*padding:\s*16px\s+0\s+12px\s+0\s*;/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/primitives/chat-message-actions/chat-message-actions.styles.spec.ts`
Expected: FAIL — current value is `padding: 4px 0 0 0;`, regex won't match.

- [ ] **Step 3: Update the padding**

In `libs/chat/src/lib/styles/chat-message-actions.styles.ts`, replace:

```
    padding: 4px 0 0 0;
```

with:

```
    padding: 16px 0 12px 0;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/primitives/chat-message-actions/chat-message-actions.styles.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/styles/chat-message-actions.styles.ts \
        libs/chat/src/lib/primitives/chat-message-actions/chat-message-actions.styles.spec.ts
git commit -m "feat(chat): increase chat-message-actions padding to 16px/12px"
```

---

## Task 4: Add scroll-fade overlay above the chat-window footer

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-window/chat-window.component.ts` (template only)
- Modify: `libs/chat/src/lib/styles/chat-window.styles.ts` (footer + new rule)
- Modify: `libs/chat/src/lib/primitives/chat-window/chat-window.component.spec.ts` (add assertion)

- [ ] **Step 1: Write the failing test**

Append the following `it` block inside the existing `describe('ChatWindowComponent', ...)` in `chat-window.component.spec.ts`:

```ts
  it('renders a scroll-fade overlay as the first child of the footer', () => {
    TestBed.configureTestingModule({});
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const footer = fx.nativeElement.querySelector('.chat-window__footer') as HTMLElement;
    const fade = footer.firstElementChild as HTMLElement;
    expect(fade).toBeTruthy();
    expect(fade.classList.contains('chat-window__scroll-fade')).toBe(true);
    expect(fade.getAttribute('aria-hidden')).toBe('true');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/primitives/chat-window/chat-window.component.spec.ts`
Expected: FAIL — `.chat-window__scroll-fade` element does not exist yet; `firstElementChild` is the projected `<div chatFooter>` node.

- [ ] **Step 3: Add the fade element to the template**

In `libs/chat/src/lib/primitives/chat-window/chat-window.component.ts`, replace the footer div in the template:

```html
<div class="chat-window__footer"><ng-content select="[chatFooter]" /></div>
```

with:

```html
<div class="chat-window__footer">
  <div class="chat-window__scroll-fade" aria-hidden="true"></div>
  <ng-content select="[chatFooter]" />
</div>
```

- [ ] **Step 4: Add the CSS rules**

In `libs/chat/src/lib/styles/chat-window.styles.ts`, replace the `.chat-window__footer` block:

```css
.chat-window__footer {
  flex-shrink: 0;
  margin-top: var(--ngaf-chat-input-gap);
}
.chat-window__footer:empty { display: none; }
```

with:

```css
.chat-window__footer {
  position: relative;
  flex-shrink: 0;
  margin-top: var(--ngaf-chat-input-gap);
}
.chat-window__footer:empty { display: none; }
.chat-window__scroll-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: 32px;
  background: linear-gradient(180deg, transparent 0%, var(--ngaf-chat-bg) 100%);
  pointer-events: none;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/primitives/chat-window/chat-window.component.spec.ts`
Expected: PASS — both the existing slot-projection test and the new fade test.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-window/chat-window.component.ts \
        libs/chat/src/lib/primitives/chat-window/chat-window.component.spec.ts \
        libs/chat/src/lib/styles/chat-window.styles.ts
git commit -m "feat(chat): add scroll-fade overlay above chat-window footer"
```

---

## Task 5: Bump @ngaf/chat to 0.0.36 and run the full library test suite

**Files:**
- Modify: `libs/chat/package.json` (version field)

- [ ] **Step 1: Bump version**

In `libs/chat/package.json`, change:

```json
  "version": "0.0.35",
```

to:

```json
  "version": "0.0.36",
```

- [ ] **Step 2: Run the full chat library test suite**

Run: `pnpm nx test chat`
Expected: all tests PASS, including the two new ones from Tasks 3 and 4.

- [ ] **Step 3: Run the angular demo's full test suite**

Run: `pnpm nx test chat-angular-example`
Expected: all tests PASS, including the rewritten welcome-suggestions tests from Task 2.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/package.json
git commit -m "chore(chat): release 0.0.36 — scroll-fade + actions padding"
```

---

## Task 6: Push branch, open PR, merge on green

- [ ] **Step 1: Push the branch**

```bash
git push -u origin claude/chat-surface-polish
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "Chat-surface polish: featured chip, scroll fade, actions padding" --body "$(cat <<'EOF'
## Summary
- Welcome suggestions collapse to a single featured chip (`FEATURED_SUGGESTIONS[0]`) + "More prompts" dropdown; canonical demo features the contact-form prompt.
- `chat-window` gains a 32px gradient overlay above the footer so chat content fades into the input area instead of clipping at a hard edge.
- `chat-message-actions` padding bumped to 16px top / 12px bottom for breathing room.
- @ngaf/chat 0.0.36.

## Test plan
- [ ] `pnpm nx test chat` passes
- [ ] `pnpm nx test chat-angular-example` passes
- [ ] Canonical demo redeploys and shows the single chip + fade + padding on demo.cacheplane.ai

Spec: docs/superpowers/specs/2026-05-17-chat-surface-polish-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI to go green**

Run: `gh pr checks --watch`
Expected: all required checks pass.

- [ ] **Step 4: Merge the PR**

Run: `gh pr merge --squash --delete-branch`
Expected: PR merged into `main`; branch deleted both remotely and locally.

- [ ] **Step 5: Verify the canonical demo redeploys**

Run: `gh run list --workflow="Canonical demo → Vercel" --limit 1`
Expected: a new run kicked off by the merge commit. Wait for it to complete (`gh run watch`), then confirm by loading https://demo.cacheplane.ai — the welcome state shows one chip + "More prompts", the fade is visible above the input, and the message-actions row has the new padding.
