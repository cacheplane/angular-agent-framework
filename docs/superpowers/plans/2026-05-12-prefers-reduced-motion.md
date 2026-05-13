# Prefers-Reduced-Motion Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Honor `prefers-reduced-motion: reduce` across `libs/chat` (including a2ui catalog) by injecting one CSS media block at the document root.

**Architecture:** Single `@media (prefers-reduced-motion: reduce)` block appended to the existing `ROOT_TOKEN_STYLES` in `libs/chat/src/lib/styles/chat-tokens.ts`. Universal `*, *::before, *::after` selector collapses all transition/animation durations to `0.01ms` with `!important`. Six targeted overrides replace infinite-loop indicators (spinner, typing dots, caret, welcome pulse, shimmer skeleton, debug pulse) with static fallbacks via `animation: none !important; opacity: 1 !important`.

**Tech Stack:** TypeScript template literals (CSS-in-TS), vitest, Angular 21 (jsdom test environment).

**Reference spec:** `docs/superpowers/specs/2026-05-12-prefers-reduced-motion-design.md`

---

### Task 1: Add reduced-motion CSS block

**Files:**
- Create: `libs/chat/src/lib/styles/chat-tokens.spec.ts`
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts`

**Context for the implementer:**

`ROOT_TOKEN_STYLES` in `chat-tokens.ts` is currently a non-exported `const` (around line 141). The function `ensureChatRootStyles()` injects it as a `<style id="ngaf-chat-root-tokens">` into `<head>` on first chat-component construction. To assert on the content cleanly from a test, **export** `ROOT_TOKEN_STYLES` as a `const`. This is a low-risk addition (it's a CSS string, not behavior).

The `chat-tokens.ts` file has no companion `.spec.ts` yet — you are creating the first one. Use vitest (the chat lib already uses it; see other `.spec.ts` files in `libs/chat/src/lib/primitives/` for patterns).

The six infinite-loop selectors come from the spec table; they appear in:
- `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts` → `.tcc__pill[data-status="running"] svg`
- `libs/chat/src/lib/styles/chat-scroll-bubble.styles.ts` → `.ngaf-chat-typing-dot`
- `libs/chat/src/lib/styles/chat-message.styles.ts` → `.ngaf-chat-caret`
- `libs/chat/src/lib/styles/chat-welcome.styles.ts` → `.ngaf-chat-welcome__pulse`
- `libs/chat/src/lib/primitives/chat-genui-skeleton/chat-genui-skeleton.component.ts` → `.chat-genui-skeleton`
- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` → `.chat-debug__pill--active`

Do NOT modify any of those component/styles files. The selectors are stable and the override goes in `chat-tokens.ts`.

---

- [ ] **Step 1: Create the failing test**

Create `libs/chat/src/lib/styles/chat-tokens.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ROOT_TOKEN_STYLES } from './chat-tokens';

describe('ROOT_TOKEN_STYLES — prefers-reduced-motion', () => {
  it('includes a prefers-reduced-motion media block', () => {
    expect(ROOT_TOKEN_STYLES).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('applies a universal selector inside the media block', () => {
    expect(ROOT_TOKEN_STYLES).toMatch(/\*,\s*\*::before,\s*\*::after/);
  });

  it('collapses animation-duration to 0.01ms', () => {
    expect(ROOT_TOKEN_STYLES).toContain('animation-duration: 0.01ms');
  });

  it('collapses transition-duration to 0.01ms', () => {
    expect(ROOT_TOKEN_STYLES).toContain('transition-duration: 0.01ms');
  });

  it('caps animation-iteration-count to 1', () => {
    expect(ROOT_TOKEN_STYLES).toContain('animation-iteration-count: 1');
  });

  it('forces auto scroll-behavior', () => {
    expect(ROOT_TOKEN_STYLES).toContain('scroll-behavior: auto');
  });

  it.each([
    '.tcc__pill[data-status="running"] svg',
    '.ngaf-chat-typing-dot',
    '.ngaf-chat-caret',
    '.ngaf-chat-welcome__pulse',
    '.chat-genui-skeleton',
    '.chat-debug__pill--active',
  ])('includes static-fallback override for %s', (selector) => {
    expect(ROOT_TOKEN_STYLES).toContain(selector);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd libs/chat && npx vitest run src/lib/styles/chat-tokens.spec.ts`

Expected: FAIL with `SyntaxError: The requested module './chat-tokens' does not provide an export named 'ROOT_TOKEN_STYLES'`

- [ ] **Step 3: Export ROOT_TOKEN_STYLES**

In `libs/chat/src/lib/styles/chat-tokens.ts`, change the declaration:

```ts
const ROOT_TOKEN_STYLES = `
```

to:

```ts
export const ROOT_TOKEN_STYLES = `
```

(Single keyword addition; nothing else changes about the constant itself.)

- [ ] **Step 4: Run tests again to confirm new failures are on content, not on import**

Run: `cd libs/chat && npx vitest run src/lib/styles/chat-tokens.spec.ts`

Expected: FAIL — all assertions about the `@media` block fail because the block doesn't exist yet. Import error is gone.

- [ ] **Step 5: Add the reduced-motion media block**

In `libs/chat/src/lib/styles/chat-tokens.ts`, locate the `ROOT_TOKEN_STYLES` template literal. It currently ends with:

```ts
}
${KEYFRAMES}
`;
```

Replace that closing region with:

```ts
}
${KEYFRAMES}
${REDUCED_MOTION_STYLES}
`;
```

Then, immediately above the `const ROOT_TOKEN_STYLES = \`` line, add:

```ts
/**
 * WCAG 2.3.3 — honor the OS-level "Reduce Motion" preference. Collapses
 * every transition/animation in the chat lib (and the a2ui catalog,
 * which renders in the same document) to instant. The `!important`
 * flag intentionally overrides any inline `style="transition: ..."`
 * applied by future code — accessibility wins.
 *
 * Infinite-loop indicators (spinner, typing dots, caret, etc.) need
 * explicit `animation: none` because `iteration-count: 1` alone would
 * freeze them mid-loop, which reads as a bug.
 */
const REDUCED_MOTION_STYLES = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .tcc__pill[data-status="running"] svg,
  .ngaf-chat-typing-dot,
  .ngaf-chat-caret,
  .ngaf-chat-welcome__pulse,
  .chat-genui-skeleton,
  .chat-debug__pill--active {
    animation: none !important;
    opacity: 1 !important;
  }

  .tcc__pill[data-status="running"] svg {
    transform: none !important;
  }
}
`;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd libs/chat && npx vitest run src/lib/styles/chat-tokens.spec.ts`

Expected: PASS — all 12 assertions green.

- [ ] **Step 7: Run the full chat suite to confirm no regression**

Run: `cd libs/chat && npx vitest run`

Expected: PASS — every chat spec passes (the change is additive to one CSS string).

- [ ] **Step 8: Manual smoke verification**

(If the implementer can run the dev server, perform this. Otherwise document in PR description for the reviewer.)

1. `npx nx serve chat-angular` (or the equivalent for the local example app).
2. macOS: System Settings → Accessibility → Display → **Reduce Motion** → on.
3. Reload `http://localhost:4200`.
4. Confirm:
   - Sidenav drawer snaps open/closed (no slide-in).
   - Tool-call spinner is a static SVG (no rotation).
   - Typing dots are three steady dots (no pulse).
   - Welcome pulse off.
   - Shimmer skeleton flat.
   - Drag-to-reorder pinned threads: grip handles still appear; drop indicator visible; row reorders instantly on drop.
5. Toggle **Reduce Motion** off, reload, confirm motion returns.

If anything above doesn't behave as listed, STOP and report. The fix likely belongs in the targeted-selector list, not the universal rule.

- [ ] **Step 9: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts libs/chat/src/lib/styles/chat-tokens.spec.ts
git commit -m "$(cat <<'EOF'
feat(chat): honor prefers-reduced-motion across chat + a2ui

Single @media block injected via ROOT_TOKEN_STYLES collapses every
transition/animation to instant under the user's OS-level "Reduce
Motion" setting. Targeted overrides replace six infinite-loop
indicators (spinner, typing dots, caret, welcome pulse, shimmer
skeleton, debug pulse) with static fallbacks — frozen mid-loop reads
as a bug.

WCAG 2.3.3 compliance. No JS, no consumer changes, no new tokens.

EOF
)"
```

- [ ] **Step 10: Push and open PR**

```bash
git push -u origin claude/prefers-reduced-motion
gh pr create --title "feat(chat): honor prefers-reduced-motion across chat + a2ui" --body "$(cat <<'EOF'
## Summary

- Adds a single `@media (prefers-reduced-motion: reduce)` block to `ROOT_TOKEN_STYLES`
- Collapses all 77 chat + a2ui transition/animation sites to instant via universal selector
- Replaces six infinite-loop indicators with static fallbacks (frozen mid-rotation reads as a bug)
- Zero new tokens, zero consumer-facing API changes

## Spec

`docs/superpowers/specs/2026-05-12-prefers-reduced-motion-design.md`

## Test plan

- [x] Unit: 12 assertions on `ROOT_TOKEN_STYLES` content (vitest)
- [ ] Manual: macOS → System Settings → Accessibility → Display → Reduce Motion → on
  - [ ] Sidenav drawer snaps open/closed (no slide)
  - [ ] Tool-call spinner static
  - [ ] Typing dots steady (no pulse)
  - [ ] Welcome pulse off
  - [ ] Shimmer skeleton flat
  - [ ] Drag-to-reorder pinned threads still works
  - [ ] Toggle off → motion returns
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** every spec section (architecture, components, data flow, error handling, testing, scope boundaries) maps to a concrete step in Task 1.
- **No placeholders:** every code block is final content the implementer pastes verbatim.
- **Type consistency:** the only exported symbol is `ROOT_TOKEN_STYLES` (string) — already used in the same file's `ensureChatRootStyles()`. No type drift.
- **Single-task:** the work genuinely is one TDD cycle. Splitting into two would create artificial granularity.
