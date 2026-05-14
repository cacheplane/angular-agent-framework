# Chat Library Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land `@ngaf/chat` library polish — user-bubble text-wrap fix, drop the duplicate `chat.css` token block (consumer-side migration included), migrate `--a2ui-*` namespace into the auto-injection path with a light variant, drop a hardcoded color fallback, add `:focus-visible` on `.chat-message__control-btn`, and tighten `modal.component.ts` accessibility.

**Architecture:** `chat-tokens.ts` becomes the sole source of truth for chat-lib CSS custom properties via `ensureChatRootStyles()` auto-injection (wrapped in `@layer ngaf-chat`). `chat.css` is deleted; consumers update their imports. The `--a2ui-*` block previously in `chat.css` moves into the auto-injected token string, with a `prefers-color-scheme: light` / `[data-theme="light"]` variant added (was dark-only — broken in light mode).

**Tech Stack:** Angular 21, Vitest, Nx, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-05-13-chat-lib-polish-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `libs/chat/src/lib/styles/chat-message.styles.ts` | Add `width: fit-content` to `.chat-message__bubble`; add `:focus-visible` block to `.chat-message__control-btn` |
| Modify | `libs/chat/src/lib/styles/chat-message-actions.styles.ts` | Drop `, #16a34a` fallback on `.chat-message-actions__check { color: ... }` |
| Modify | `libs/chat/src/lib/styles/chat-tokens.ts` | Append `--a2ui-*` token block to `LIGHT_TOKENS`/`DARK_TOKENS` (split current dark values into theme variants) |
| Delete | `libs/chat/src/lib/styles/chat.css` | No longer needed — `ensureChatRootStyles()` covers it |
| Modify | `libs/chat/src/lib/a2ui/catalog/modal.component.ts` | Move inline `display:contents` to styles array; add `aria-label` to trigger element |
| Modify | `examples/chat/angular/src/styles.css` | Drop `@import '../../../../libs/chat/src/lib/styles/chat.css'` line |
| Modify | `examples/chat/smoke/template/src/styles.css` | Drop `@import '@ngaf/chat/chat.css'` line |
| Modify | `libs/chat/package.json` | Patch bump |

---

## Task 1: Fix user-bubble text wrap

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-message.styles.ts`

The user bubble has `max-width: 80%` (caps growth) but no `width: fit-content` — its flex parent allows shrink below intrinsic width, so single-word content like `"hello"` wraps mid-word. Adding `width: fit-content` pins the bubble to content width up to the cap.

- [ ] **Step 1: Read current rule**

```bash
sed -n '22,32p' libs/chat/src/lib/styles/chat-message.styles.ts
```

Expected lines (around 22-30):

```css
  .chat-message__bubble {
    max-width: 80%;
    padding: 8px 12px;
    border-radius: var(--ngaf-chat-radius-bubble);
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    white-space: pre-wrap;
    line-height: var(--ngaf-chat-line-height-tight);
    font-size: var(--ngaf-chat-font-size);
    overflow-wrap: break-word;
  }
```

- [ ] **Step 2: Add `width: fit-content`**

Edit `libs/chat/src/lib/styles/chat-message.styles.ts`. Replace the `.chat-message__bubble` block above with:

```css
  .chat-message__bubble {
    width: fit-content;
    max-width: 80%;
    padding: 8px 12px;
    border-radius: var(--ngaf-chat-radius-bubble);
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    white-space: pre-wrap;
    line-height: var(--ngaf-chat-line-height-tight);
    font-size: var(--ngaf-chat-font-size);
    overflow-wrap: break-word;
  }
```

`width: fit-content` is the only added line. Everything else stays.

- [ ] **Step 3: Run chat tests**

```bash
pnpm nx test chat
```

Expected: all green. No layout assertions exist, so the CSS change is invisible to existing tests.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/styles/chat-message.styles.ts
git commit -m "fix(chat): bubble width: fit-content to prevent single-word wrap"
```

---

## Task 2: Add `:focus-visible` ring to control button

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-message.styles.ts`

`.chat-message__control-btn` has `:hover` styling but no `:focus-visible` — keyboard users get no focus indicator on the regenerate/copy/rate controls.

- [ ] **Step 1: Read current control-btn block**

```bash
sed -n '84,96p' libs/chat/src/lib/styles/chat-message.styles.ts
```

Expected lines (around 84-95):

```css
  .chat-message__control-btn {
    width: 20px;
    height: 20px;
    border: 0;
    background: transparent;
    ...
  }
  .chat-message__control-btn:hover { transform: scale(1.05); }
  .chat-message__control-btn svg { width: 16px; height: 16px; pointer-events: none; }
```

- [ ] **Step 2: Add `:focus-visible` rule**

After the `:hover` rule, insert a `:focus-visible` rule matching the lib's existing focus pattern (used in `chat-message-actions.styles.ts`):

```css
  .chat-message__control-btn:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
    border-radius: 4px;
  }
```

Place it between the `:hover` line and the `svg` line.

- [ ] **Step 3: Run chat tests**

```bash
pnpm nx test chat
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/styles/chat-message.styles.ts
git commit -m "fix(chat): add focus-visible ring on chat-message control buttons"
```

---

## Task 3: Drop hardcoded color fallback

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-message-actions.styles.ts`

`color: var(--ngaf-chat-success, #16a34a)` — the `#16a34a` fallback only matches the light token; in dark mode the token is `#4ade80` and the fallback would mislead if the var ever became undefined. `ensureChatRootStyles()` guarantees the var is always defined, so the fallback is dead.

- [ ] **Step 1: Read current rule**

```bash
sed -n '65,70p' libs/chat/src/lib/styles/chat-message-actions.styles.ts
```

Expected:

```css
  .chat-message-actions__check {
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    color: var(--ngaf-chat-success, #16a34a);
  }
```

- [ ] **Step 2: Drop the fallback**

Edit `libs/chat/src/lib/styles/chat-message-actions.styles.ts`. Change line 69 to:

```css
    color: var(--ngaf-chat-success);
```

- [ ] **Step 3: Run chat tests**

```bash
pnpm nx test chat
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/styles/chat-message-actions.styles.ts
git commit -m "fix(chat): drop hardcoded #16a34a fallback (token is always defined)"
```

---

## Task 4: Migrate `--a2ui-*` namespace into `chat-tokens.ts` with light variant

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts`

The `--a2ui-*` token block currently lives only in `chat.css` (dropped in Task 5). Migrate it to `chat-tokens.ts` so it auto-injects, and add a `prefers-color-scheme: light` / `[data-theme="light"]` variant — currently dark-only, `<a2ui-surface>` renders white-on-near-black on light pages.

The existing `chat-tokens.ts` defines `LIGHT_TOKENS` and `DARK_TOKENS` template strings interpolated into a `ROOT_TOKEN_STYLES` constant. Theme-variant `--a2ui-*` keys join those existing strings; theme-invariant keys (spacing, typography, shape, motion, focus-ring, aliases) go into a new `A2UI_INVARIANT_TOKENS` template.

- [ ] **Step 1: Read current `LIGHT_TOKENS` and `DARK_TOKENS`**

```bash
grep -n "LIGHT_TOKENS\s*=\|DARK_TOKENS\s*=\|ROOT_TOKEN_STYLES\s*=" libs/chat/src/lib/styles/chat-tokens.ts
```

Note their line numbers. `LIGHT_TOKENS` should be a string template literal containing `--ngaf-chat-*: rgb(...)` etc. Same for `DARK_TOKENS`.

- [ ] **Step 2: Append `--a2ui-*` light values to `LIGHT_TOKENS`**

Add these lines INSIDE the `LIGHT_TOKENS` template string (just before the closing backtick):

```
  /* --a2ui-* light variant */
  --a2ui-primary: #4f8df5;
  --a2ui-on-primary: #ffffff;
  --a2ui-primary-hover: #3a78e0;
  --a2ui-secondary: #5f6470;
  --a2ui-on-secondary: #ffffff;
  --a2ui-surface: #ffffff;
  --a2ui-on-surface: #1a1d23;
  --a2ui-surface-variant: rgba(0, 0, 0, 0.04);
  --a2ui-on-surface-variant: rgba(0, 0, 0, 0.6);
  --a2ui-outline: rgba(0, 0, 0, 0.12);
  --a2ui-outline-variant: rgba(0, 0, 0, 0.06);
  --a2ui-error: #dc2626;
  --a2ui-on-error: #ffffff;
  --a2ui-scrim: rgba(0, 0, 0, 0.4);
  --a2ui-elevation-0: none;
  --a2ui-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.06);
  --a2ui-elevation-2: 0 2px 4px rgba(0, 0, 0, 0.08);
  --a2ui-elevation-3: 0 4px 8px rgba(0, 0, 0, 0.10);
  --a2ui-elevation-4: 0 8px 16px rgba(0, 0, 0, 0.14);
  --a2ui-elevation-5: 0 16px 32px rgba(0, 0, 0, 0.18);
```

- [ ] **Step 3: Append `--a2ui-*` dark values to `DARK_TOKENS`**

Add these lines INSIDE the `DARK_TOKENS` template string (just before the closing backtick):

```
  /* --a2ui-* dark variant (preserves current chat.css values) */
  --a2ui-primary: #4f8df5;
  --a2ui-on-primary: #ffffff;
  --a2ui-primary-hover: #6699f7;
  --a2ui-secondary: #8a92a3;
  --a2ui-on-secondary: #ffffff;
  --a2ui-surface: #1a1d23;
  --a2ui-on-surface: #ffffff;
  --a2ui-surface-variant: rgba(255, 255, 255, 0.05);
  --a2ui-on-surface-variant: rgba(255, 255, 255, 0.7);
  --a2ui-outline: rgba(255, 255, 255, 0.1);
  --a2ui-outline-variant: rgba(255, 255, 255, 0.05);
  --a2ui-error: #f5524f;
  --a2ui-on-error: #ffffff;
  --a2ui-scrim: rgba(0, 0, 0, 0.6);
  --a2ui-elevation-0: none;
  --a2ui-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3);
  --a2ui-elevation-2: 0 2px 4px rgba(0, 0, 0, 0.35);
  --a2ui-elevation-3: 0 4px 8px rgba(0, 0, 0, 0.4);
  --a2ui-elevation-4: 0 8px 16px rgba(0, 0, 0, 0.45);
  --a2ui-elevation-5: 0 16px 32px rgba(0, 0, 0, 0.5);
```

- [ ] **Step 4: Add a theme-invariant `--a2ui-*` block**

Find the `ROOT_TOKEN_STYLES` declaration (a tagged template literal that wraps `:root { ... }` + light/dark blocks + the variant `[data-theme=...]` selectors). Read it to understand its structure, then add a new constant ABOVE it:

```ts
const A2UI_INVARIANT_TOKENS = `
  /* --a2ui-* theme-invariant tokens (spacing, typography, shape, motion, focus, aliases) */

  /* Spacing scale (4px base) */
  --a2ui-spacing-1: 4px;
  --a2ui-spacing-2: 8px;
  --a2ui-spacing-3: 12px;
  --a2ui-spacing-4: 16px;
  --a2ui-spacing-5: 24px;
  --a2ui-spacing-6: 32px;
  --a2ui-spacing-7: 40px;

  /* Typography (per Text usageHint) */
  --a2ui-typography-h1-size: 32px;
  --a2ui-typography-h1-weight: 700;
  --a2ui-typography-h1-line-height: 1.2;
  --a2ui-typography-h2-size: 24px;
  --a2ui-typography-h2-weight: 600;
  --a2ui-typography-h2-line-height: 1.3;
  --a2ui-typography-h3-size: 20px;
  --a2ui-typography-h3-weight: 600;
  --a2ui-typography-h3-line-height: 1.3;
  --a2ui-typography-h4-size: 18px;
  --a2ui-typography-h4-weight: 500;
  --a2ui-typography-h4-line-height: 1.4;
  --a2ui-typography-h5-size: 16px;
  --a2ui-typography-h5-weight: 500;
  --a2ui-typography-h5-line-height: 1.4;
  --a2ui-typography-body-size: 14px;
  --a2ui-typography-body-weight: 400;
  --a2ui-typography-body-line-height: 1.5;
  --a2ui-typography-caption-size: 12px;
  --a2ui-typography-caption-weight: 400;
  --a2ui-typography-caption-line-height: 1.4;
  --a2ui-typography-label-size: 12px;
  --a2ui-typography-label-weight: 500;

  /* Shape radius */
  --a2ui-shape-extra-small: 4px;
  --a2ui-shape-small: 8px;
  --a2ui-shape-medium: 12px;
  --a2ui-shape-large: 16px;
  --a2ui-shape-extra-large: 28px;

  /* Focus ring */
  --a2ui-focus-ring-color: var(--a2ui-primary);
  --a2ui-focus-ring-width: 2px;

  /* Motion */
  --a2ui-motion-duration-short: 100ms;
  --a2ui-motion-duration-medium: 200ms;
  --a2ui-motion-duration-long: 300ms;
  --a2ui-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --a2ui-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1.4);

  /* Aliases (kept for back-compat) */
  --a2ui-card-bg: var(--a2ui-surface);
  --a2ui-input-bg: var(--a2ui-surface-variant);
  --a2ui-input-text: var(--a2ui-on-surface);
  --a2ui-label: var(--a2ui-on-surface-variant);
  --a2ui-caption: var(--a2ui-on-surface-variant);
  --a2ui-border: var(--a2ui-outline);
`;
```

- [ ] **Step 5: Interpolate `A2UI_INVARIANT_TOKENS` into `ROOT_TOKEN_STYLES`**

`ROOT_TOKEN_STYLES` already injects `:root { ${LIGHT_TOKENS} }` etc. Add `${A2UI_INVARIANT_TOKENS}` into the same `:root` block — it should be in ONE place (not duplicated per theme), so add it inside the bare `:root { ... }` rule that's the default-light fallback. Example structure (read the actual file to confirm):

```ts
const ROOT_TOKEN_STYLES = `
@layer ngaf-chat {
  :root {
    ${LIGHT_TOKENS}
    ${A2UI_INVARIANT_TOKENS}
  }

  @media (prefers-color-scheme: dark) {
    :root { ${DARK_TOKENS} }
  }

  :root[data-theme="light"],
  [data-theme="light"] { ${LIGHT_TOKENS} }
  :root[data-theme="dark"],
  [data-theme="dark"] { ${DARK_TOKENS} }
}
${KEYFRAMES}
${REDUCED_MOTION_STYLES}
`;
```

The invariants stay in the default-light block. They're invariant, so any subsequent theme override doesn't redeclare them — they cascade through.

- [ ] **Step 6: Run chat tests**

```bash
pnpm nx test chat
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts
git commit -m "feat(chat): migrate --a2ui-* tokens into auto-injection with light variant"
```

---

## Task 5: Delete `chat.css` and migrate consumers

**Files:**
- Delete: `libs/chat/src/lib/styles/chat.css`
- Modify: `examples/chat/angular/src/styles.css`
- Modify: `examples/chat/smoke/template/src/styles.css`

After Task 4, every `--ngaf-chat-*` and `--a2ui-*` token is auto-injected via `ensureChatRootStyles()`. The standalone `chat.css` file is redundant and drift-prone (it had a missed `data-theme` rename, etc.). Delete it.

- [ ] **Step 1: Verify no remaining consumers besides the two known sites**

```bash
rg "@ngaf/chat/chat\.css|chat/src/lib/styles/chat\.css" --type css --type ts -g '!docs/**'
```

Expected matches: exactly two — `examples/chat/angular/src/styles.css` and `examples/chat/smoke/template/src/styles.css`. (Doc-only references are spec mentions, not real imports.)

If additional sites surface, add a step to update those too.

- [ ] **Step 2: Delete `chat.css`**

```bash
git rm libs/chat/src/lib/styles/chat.css
```

- [ ] **Step 3: Update `examples/chat/angular/src/styles.css`**

Read the file. Find the line:

```css
@import '../../../../libs/chat/src/lib/styles/chat.css';
```

Delete it. If there's a comment above explaining the import, delete the comment block too. Keep all other styles.

- [ ] **Step 4: Update `examples/chat/smoke/template/src/styles.css`**

Read the file. Find the line:

```css
@import '@ngaf/chat/chat.css';
```

Delete it. Keep all other styles.

- [ ] **Step 5: Verify consumers build clean**

```bash
pnpm nx build examples-chat-angular
```

If a different project name applies, find it with `pnpm nx show projects | rg 'examples.*chat'`. Expected: clean build, no missing-import errors.

The smoke template isn't an Nx project (it's a template); verify manually by inspecting its `styles.css` for syntax errors and confirming the only change was the `@import` removal.

- [ ] **Step 6: Run chat lib tests**

```bash
pnpm nx test chat
```

Expected: all green. `chat.css` had no tests of its own — the file was a global stylesheet.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/styles/chat.css examples/chat/angular/src/styles.css examples/chat/smoke/template/src/styles.css
git commit -m "refactor(chat): delete chat.css (auto-injected via ensureChatRootStyles)"
```

---

## Task 6: Fix `modal.component.ts` accessibility + inline style

**Files:**
- Modify: `libs/chat/src/lib/a2ui/catalog/modal.component.ts`

Two issues at the trigger element:
1. Inline `style="display:contents"` — should move to the styles array (and `display:contents` removes the element from the accessibility tree in older browsers; we'll use a class instead).
2. Missing `aria-label` on the `role="button"` element.

- [ ] **Step 1: Read the relevant section**

```bash
sed -n '1,25p' libs/chat/src/lib/a2ui/catalog/modal.component.ts
```

The trigger element around line 13-16 looks like:

```html
@if (entryPointKey(); as epKey) {
  <div (click)="open.set(true)" (keydown.enter)="open.set(true)" (keydown.space)="open.set(true)"
    role="button" tabindex="0" style="display:contents">
    <render-element [elementKey]="epKey" [spec]="spec()" />
  </div>
}
```

- [ ] **Step 2: Replace the inline style with a class + add `aria-label`**

Edit the template:

```html
@if (entryPointKey(); as epKey) {
  <div
    class="a2ui-modal__trigger"
    role="button"
    tabindex="0"
    aria-label="Open modal"
    (click)="open.set(true)"
    (keydown.enter)="open.set(true)"
    (keydown.space)="open.set(true)"
  >
    <render-element [elementKey]="epKey" [spec]="spec()" />
  </div>
}
```

- [ ] **Step 3: Add the class to the component's styles**

The component has a `styles:` array on its `@Component` decorator. Read it (search the file for `styles:`), then add this rule:

```css
.a2ui-modal__trigger {
  display: contents;
}
```

If `styles:` doesn't exist on the component yet, add one:

```ts
@Component({
  selector: 'a2ui-modal',
  // ...existing decorator fields...
  styles: [`
    .a2ui-modal__trigger { display: contents; }
  `],
  // ...
})
```

- [ ] **Step 4: Run chat tests**

```bash
pnpm nx test chat
```

Expected: all green. (If a spec asserts the trigger's `aria-label` attribute is absent or has another value, update it — but this is unlikely; modal isn't heavily covered.)

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/catalog/modal.component.ts
git commit -m "fix(chat): a2ui modal trigger — class instead of inline style + aria-label"
```

---

## Task 7: Version bump + full check stack

**Files:**
- Modify: `libs/chat/package.json`

- [ ] **Step 1: Read current version**

```bash
grep '"version"' libs/chat/package.json
```

- [ ] **Step 2: Increment patch**

Edit `libs/chat/package.json`, increment the last digit of the version. Patch-only release rule — never bump to 0.1.x.

- [ ] **Step 3: Run the full check stack**

```bash
pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,chat,cockpit
```

Expected: all green.

```bash
pnpm nx e2e cockpit
```

Expected: all green (cockpit's own e2e doesn't touch chat-lib internals, but verifies regression).

```bash
pnpm nx build website
```

Expected: green.

```bash
pnpm nx build cockpit-chat-timeline-angular
```

Expected: green. This is the chat-timeline pilot — its iframe ships the chat lib, so a chat-lib break would surface here.

```bash
pnpm nx build examples-chat-angular
```

Expected: green. This is the canonical chat demo using the chat lib + dropped `chat.css` import.

If any failure surfaces:
- **chat lib tests asserting `chat.css` exists or specific token strings** → update assertions to the new auto-injection path
- **Build errors on missing `@ngaf/chat/chat.css`** → verify both consumer `styles.css` files had their `@import` removed
- **Bubble width changes visible in cockpit e2e snapshot** → either the snapshot was capturing layout (unlikely) or the test asserts something else; investigate

- [ ] **Step 4: Commit**

```bash
git add libs/chat/package.json
git commit -m "chore: bump chat patch version"
```

---

## Task 8: Open PR + merge on green

- [ ] **Step 1: Push branch**

```bash
git push -u origin chat-lib-polish
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "fix(chat): library polish — bubble width, chat.css drop, a2ui light variant, a11y" --body "$(cat <<'EOF'
## Summary

Second in a three-PR sequence (spec: \`docs/superpowers/specs/2026-05-13-chat-lib-polish-design.md\`, plan: \`docs/superpowers/plans/2026-05-13-chat-lib-polish.md\`).

- **User-bubble text-wrap fix:** add \`width: fit-content\` to \`.chat-message__bubble\` so single-word messages render at content width. Bug was triggered by \`max-width: 80%\` only capping growth while a flex parent allowed shrink below intrinsic width — \"hello\" rendered as \"hel\" / \"lo\".
- **Drop \`libs/chat/src/lib/styles/chat.css\`** (the global stylesheet). \`ensureChatRootStyles()\` auto-injects every \`--ngaf-chat-*\` and \`--a2ui-*\` token via a \`@layer ngaf-chat\`-wrapped \`<style>\` element on first chat-component load, so \`chat.css\` was a drift-prone duplicate (had a missed \`data-theme\` rename, etc.). Breaking for external consumers importing \`@ngaf/chat/chat.css\`; two known internal consumers (\`examples/chat/angular\`, \`examples/chat/smoke/template\`) have their imports dropped here.
- **\`--a2ui-*\` namespace migration:** the 30+ tokens previously declared only in \`chat.css\` move into \`chat-tokens.ts\` (auto-injected). Adds a \`prefers-color-scheme: light\` / \`[data-theme=\"light\"]\` variant — previously dark-only, so \`<a2ui-surface>\` rendered white-on-near-black on light pages.
- **Drop hardcoded \`#16a34a\` fallback** at \`chat-message-actions.styles.ts:69\` — \`--ngaf-chat-success\` is always defined by the auto-injection.
- **Add \`:focus-visible\` ring** to \`.chat-message__control-btn\` — keyboard accessibility hole on regenerate/copy/rate controls.
- **\`modal.component.ts\` a11y + cleanup:** move inline \`style=\"display:contents\"\` to a styles-array class; add explicit \`aria-label\` to the \`role=\"button\"\` trigger.

PR 3 (cockpit ↔ website style alignment + chat lib palette unification with \`--ds-*\`) follows.

## Test plan

- [x] \`pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,chat,cockpit\` — green
- [x] \`pnpm nx e2e cockpit\` — green
- [x] \`pnpm nx build website\` — green
- [x] \`pnpm nx build cockpit-chat-timeline-angular\` — green
- [x] \`pnpm nx build examples-chat-angular\` — green
- [ ] Manual chrome MCP smoke: submit \"hello\" — bubble width matches text, no mid-word wrap

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for green CI**

```bash
gh pr checks --watch
```

- [ ] **Step 4: Squash-merge**

```bash
gh pr merge --squash --delete-branch
```

---

## Self-review

**Spec coverage:**
- ✅ Decision 1 (text-wrap `width: fit-content`) → Task 1
- ✅ Decision 2 (no regression test) → omitted by design
- ✅ Decision 3 (drop `chat.css`) → Task 5
- ✅ Decision 4 (`--a2ui-*` migration + light variant) → Task 4
- ✅ Decision 5 (drop `#16a34a` fallback) → Task 3
- ✅ Decision 6 (`.chat-message__control-btn :focus-visible`) → Task 2
- ✅ Decision 7 (modal a11y + inline style) → Task 6

**Adjustments from spec during plan-prep exploration:**
1. **Task 4 splits invariant from theme-variant tokens.** Spec described mapping table for theme-variant `--a2ui-*` keys; plan adds a separate `A2UI_INVARIANT_TOKENS` constant for spacing/typography/shape/motion/aliases that don't change per theme. Cleaner than duplicating ~50 invariant lines across both `LIGHT_TOKENS` and `DARK_TOKENS`.
2. **Plan separately adds `pnpm nx build examples-chat-angular`** to the check stack since that's where the `@import '@ngaf/chat/chat.css'` removal needs to be verified.

**Placeholder scan:** No "TBD" / "TODO". The "find the styles array" step in Task 6 references reading the actual file because the modal component's structure varies — but the substitution is fully described.

**Type consistency:** No types touched. CSS variable names consistent: `--ngaf-chat-*`, `--a2ui-*`, `--ds-*` (in Task 6's commit message reference, not the code itself).
