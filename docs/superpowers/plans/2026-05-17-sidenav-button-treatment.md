# Sidenav Button Treatment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull the sidenav's "New chat" and "New project" buttons into the chat-input monochrome button system so the sidenav and chat surface read as one product.

**Architecture:** CSS-only changes inside @ngaf/chat — two style modules, two new CSS-string unit specs. No template changes, no consumer-API changes.

**Tech Stack:** TypeScript template literals carrying CSS, vitest for CSS-string assertions, Angular 20+ standalone component styles.

**Branch:** `claude/sidenav-button-treatment` (already created off `eb419da9`; spec committed).

**Spec:** `docs/superpowers/specs/2026-05-17-sidenav-button-treatment-design.md`

---

## File map

| File | Change |
|---|---|
| `libs/chat/src/lib/styles/chat-sidenav.styles.ts` | Update both `.chat-sidenav__action--new` rule blocks for monochrome fill + new padding |
| `libs/chat/src/lib/styles/chat-project-list.styles.ts` | Update `.chat-project-list__new` for solid surface-alt fill, no border, new padding |
| `libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts` | NEW — assert the new CSS values |
| `libs/chat/src/lib/styles/chat-project-list.styles.spec.ts` | NEW — assert the new CSS values |
| `libs/chat/package.json` + 6 sibling libs | Bump 0.0.36 → 0.0.37 (uniform publishable release group) |

---

## Task 1: Restyle New chat as the text-color CTA pill

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-sidenav.styles.ts:102-122, 178-189`
- Create: `libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts` with:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { CHAT_SIDENAV_STYLES } from './chat-sidenav.styles';

describe('CHAT_SIDENAV_STYLES — New chat button', () => {
  const normalized = CHAT_SIDENAV_STYLES.replace(/\s+/g, ' ');

  it('uses --ngaf-chat-text as the late-cascade fill (monochrome CTA, not brand-primary)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new\s*\{[^}]*background:\s*var\(--ngaf-chat-text\)\s*;/,
    );
  });

  it('uses --ngaf-chat-bg as the late-cascade text color (inverse for contrast)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new\s*\{[^}]*color:\s*var\(--ngaf-chat-bg\)\s*;/,
    );
  });

  it('uses 12px / 18px padding for a slightly larger CTA presence', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new\s*\{[^}]*padding:\s*12px\s+18px\s*;/,
    );
  });

  it('uses brightness(0.92) on hover (subtle darken on the light fill)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action\.chat-sidenav__action--new:hover\s*\{[^}]*filter:\s*brightness\(0\.92\)\s*;/,
    );
  });

  it('keeps the primary-color focus ring (a11y affordance, not chrome)', () => {
    expect(normalized).toMatch(
      /\.chat-sidenav__action--new:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--ngaf-chat-primary\)\s*;/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts`
Expected: FAIL — current values are `var(--ngaf-chat-primary)` fill, `10px 16px` padding, `brightness(1.1)` hover.

- [ ] **Step 3: Update the early `.chat-sidenav__action--new` block**

In `libs/chat/src/lib/styles/chat-sidenav.styles.ts`, replace the block at lines 102-122:

```css
  .chat-sidenav__action--new {
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    border: 0;
    padding: 10px 16px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    width: 100%;
  }
  .chat-sidenav__action--new:hover {
    filter: brightness(1.1);
  }
  .chat-sidenav__action--new:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
```

with (note: fill + text color removed from this block; they're set by the late-cascade block below):

```css
  .chat-sidenav__action--new {
    /* Geometry only — fill/color set by the late-cascade
       .chat-sidenav__action.chat-sidenav__action--new block. */
    border: 0;
    padding: 12px 18px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    width: 100%;
  }
  .chat-sidenav__action--new:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
```

- [ ] **Step 4: Update the late-cascade `.chat-sidenav__action.chat-sidenav__action--new` block**

In the same file, replace the block at lines 178-189:

```css
  .chat-sidenav__action.chat-sidenav__action--new {
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    border-radius: 9999px;
    padding: 10px 16px;
    font-weight: 600;
    font-size: 13px;
  }
  .chat-sidenav__action.chat-sidenav__action--new:hover {
    background: var(--ngaf-chat-primary);
    filter: brightness(1.1);
  }
```

with:

```css
  .chat-sidenav__action.chat-sidenav__action--new {
    background: var(--ngaf-chat-text);
    color: var(--ngaf-chat-bg);
    border-radius: 9999px;
    padding: 12px 18px;
    font-weight: 600;
    font-size: 13px;
  }
  .chat-sidenav__action.chat-sidenav__action--new:hover {
    background: var(--ngaf-chat-text);
    filter: brightness(0.92);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts`
Expected: all 5 PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/styles/chat-sidenav.styles.ts \
        libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts
git commit -m "feat(chat): restyle New chat as monochrome text-color CTA"
```

---

## Task 2: Restyle New project as a borderless surface-alt pill

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-project-list.styles.ts:77-93`
- Create: `libs/chat/src/lib/styles/chat-project-list.styles.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/styles/chat-project-list.styles.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { CHAT_PROJECT_LIST_STYLES } from './chat-project-list.styles';

describe('CHAT_PROJECT_LIST_STYLES — New project button', () => {
  const normalized = CHAT_PROJECT_LIST_STYLES.replace(/\s+/g, ' ');

  it('uses --ngaf-chat-surface-alt fill (solid secondary, not outlined)', () => {
    expect(normalized).toMatch(
      /\.chat-project-list__new\s*\{[^}]*background:\s*var\(--ngaf-chat-surface-alt\)\s*;/,
    );
  });

  it('uses --ngaf-chat-text color (full strength, not muted)', () => {
    expect(normalized).toMatch(
      /\.chat-project-list__new\s*\{[^}]*color:\s*var\(--ngaf-chat-text\)\s*;/,
    );
  });

  it('removes the separator border', () => {
    expect(normalized).toMatch(
      /\.chat-project-list__new\s*\{[^}]*border:\s*0\s*;/,
    );
  });

  it('uses 10px / 16px padding for more presence', () => {
    expect(normalized).toMatch(
      /\.chat-project-list__new\s*\{[^}]*padding:\s*10px\s+16px\s*;/,
    );
  });

  it('lifts hover via color-mix on top of surface-alt', () => {
    expect(normalized).toMatch(
      /\.chat-project-list__new:hover\s*\{[^}]*background:\s*color-mix\(in srgb,\s*var\(--ngaf-chat-text\)\s*8%,\s*var\(--ngaf-chat-surface-alt\)\)\s*;/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/styles/chat-project-list.styles.spec.ts`
Expected: FAIL — current values are `var(--ngaf-chat-surface)` fill, `1px solid var(--ngaf-chat-separator)` border, `8px 14px` padding.

- [ ] **Step 3: Update `.chat-project-list__new`**

In `libs/chat/src/lib/styles/chat-project-list.styles.ts`, replace lines 77-93:

```css
  .chat-project-list__new {
    background: var(--ngaf-chat-surface);
    color: var(--ngaf-chat-text-muted);
    border: 1px solid var(--ngaf-chat-separator);
    padding: 8px 14px;
    border-radius: 9999px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    width: 100%;
  }
  .chat-project-list__new:hover {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
  }
```

with:

```css
  .chat-project-list__new {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
    border: 0;
    padding: 10px 16px;
    border-radius: 9999px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    width: 100%;
  }
  .chat-project-list__new:hover {
    background: color-mix(in srgb, var(--ngaf-chat-text) 8%, var(--ngaf-chat-surface-alt));
    color: var(--ngaf-chat-text);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/styles/chat-project-list.styles.spec.ts`
Expected: all 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/styles/chat-project-list.styles.ts \
        libs/chat/src/lib/styles/chat-project-list.styles.spec.ts
git commit -m "feat(chat): restyle New project as borderless surface-alt pill"
```

---

## Task 3: Bump publishable libs to 0.0.37

**Files:**
- Modify: `libs/{a2ui,ag-ui,chat,langgraph,licensing,render,telemetry}/package.json` (version field, all 7)

- [ ] **Step 1: Bump all seven publishable libs**

For each of `libs/a2ui/package.json`, `libs/ag-ui/package.json`, `libs/chat/package.json`, `libs/langgraph/package.json`, `libs/licensing/package.json`, `libs/render/package.json`, `libs/telemetry/package.json`, change `"version": "0.0.36"` → `"version": "0.0.37"`.

- [ ] **Step 2: Verify all seven match**

Run: `grep '"version"' libs/a2ui/package.json libs/ag-ui/package.json libs/chat/package.json libs/langgraph/package.json libs/licensing/package.json libs/render/package.json libs/telemetry/package.json`
Expected: all seven show `"version": "0.0.37"`.

- [ ] **Step 3: Run full chat lib test suite**

Run: `pnpm nx test chat`
Expected: all pass, including the two new style specs.

- [ ] **Step 4: Commit**

```bash
git add libs/a2ui/package.json libs/ag-ui/package.json libs/chat/package.json \
        libs/langgraph/package.json libs/licensing/package.json \
        libs/render/package.json libs/telemetry/package.json
git commit -m "chore(release): bump publishable libs to 0.0.37"
```
