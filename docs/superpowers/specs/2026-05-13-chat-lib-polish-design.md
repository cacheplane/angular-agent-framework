# `@ngaf/chat` Library Polish — Design

**Date:** 2026-05-13
**Status:** Spec — pending implementation plan
**Spec series:** Second in a three-PR sequence (cockpit polish → chat lib polish → cockpit ↔ website style alignment)

## Goal

Tighten `@ngaf/chat`: fix the user-message-bubble text-wrap bug, eliminate the drift-prone duplicate token system (`chat.css` vs `chat-tokens.ts`), patch the a2ui surface namespace so it works in light mode, and close two small accessibility holes surfaced during the audit.

The audit pass for this PR turned up more than the user-visible bug — fixing them now gets the chat lib into the best state to receive PR 3's visual unification with the cockpit design tokens.

Out of scope:
- Visual palette unification with `--ds-*` design tokens — PR 3
- `image.component.ts` chained `[style.*]` bindings refactor — not a bug, deferred
- Any chat lib feature work beyond the listed fixes
- Migration of the broader chat lib API surface

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Text-wrap bug fix mechanism | `width: fit-content` on `.chat-message__bubble` to prevent flex-shrink below intrinsic content width |
| 2 | Regression test | None. Bubble width is a one-shot CSS fix, not a regression-prone surface. E2E coverage budget targets high-value scenarios elsewhere. |
| 3 | Token de-duplication direction | Drop `libs/chat/src/lib/styles/chat.css` entirely. `ensureChatRootStyles()` is the single source of truth. No backwards compat. |
| 4 | `--a2ui-*` namespace handling | Migrate the entire `--a2ui-*` block from `chat.css` into `chat-tokens.ts` so it's auto-injected. Add a `prefers-color-scheme: light` / `[data-theme="light"]` variant. |
| 5 | Hardcoded fallback color | Drop the `, #16a34a` fallback at `chat-message-actions.styles.ts:69`. `ensureChatRootStyles()` guarantees the var is defined. |
| 6 | `.chat-message__control-btn` focus | Add `:focus-visible` ring matching the existing `chat-message-actions.styles.ts:52` focus pattern (`outline: 2px solid var(--ngaf-chat-primary); outline-offset: 2px`) |
| 7 | `modal.component.ts` inline style | Move `style="display:contents"` to the styles array. Add explicit `aria-label` to the button-role element. |

## Architecture

**Token system after this PR:**

- **Sole source of truth: `chat-tokens.ts`** — exports CSS string constants and `ensureChatRootStyles()`, which appends `<style id="ngaf-chat-root-tokens">` to `<head>` on first chat-component construction, wrapped in `@layer ngaf-chat`. Consumer overrides at `:root` win via the `@layer` cascade.
- **`chat.css` deleted.** Examples that imported it remove the import line; tokens still resolve via the TS auto-injection path.

**`--a2ui-*` cascade (added to `chat-tokens.ts`):**

```css
@layer ngaf-chat {
  :root {
    /* dark-skewed defaults — preserve current production behavior */
    --a2ui-surface: #1a1d23;
    --a2ui-on-surface: #ffffff;
    --a2ui-outline: rgba(255, 255, 255, 0.1);
    /* ...rest of the block from chat.css... */
  }

  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      /* light counterpart */
      --a2ui-surface: #ffffff;
      --a2ui-on-surface: #1a1d23;
      --a2ui-outline: rgba(0, 0, 0, 0.12);
      /* ...rest of light values... */
    }
  }

  [data-theme="light"] {
    /* same light values — programmatic override */
  }
}
```

The exact light hex values are picked to be readable counterparts of the dark values (not connected to `--ds-*` — that's PR 3). For surfaces: black on white; for elevations: black-with-low-alpha shadows; for outlines: black-with-low-alpha. Specifics in the implementation plan.

**Text wrap fix:**

```css
/* before */
.chat-message__bubble {
  max-width: 80%;
  /* ... */
  overflow-wrap: break-word;
}

/* after */
.chat-message__bubble {
  width: fit-content;
  max-width: 80%;
  /* ... */
  overflow-wrap: break-word;
}
```

`width: fit-content` keeps the bubble sized to content up to `max-width`. `overflow-wrap: break-word` still handles overflow at word boundaries for long messages.

## Package changes

**`@ngaf/chat`:** patch bump
- Delete: `libs/chat/src/lib/styles/chat.css`
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts` — absorb `--a2ui-*` token block from `chat.css`; add light variant
- Modify: `libs/chat/src/lib/styles/chat-message.styles.ts` — add `width: fit-content` to `.chat-message__bubble`; add `:focus-visible` ring to `.chat-message__control-btn`
- Modify: `libs/chat/src/lib/styles/chat-message-actions.styles.ts` — drop `#16a34a` fallback
- Modify: `libs/chat/src/lib/a2ui/catalog/modal.component.ts` — move inline `style="display:contents"` to styles array; add `aria-label`
- Modify: `libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts` (or equivalent) — new regression test for single-word bubble width
- Modify: `libs/chat/package.json` — patch bump

**Consumers to migrate** (drop `@import '@ngaf/chat/chat.css'`):
- `examples/chat/angular/src/styles.css`
- `examples/chat/smoke/template/src/styles.css`

## `--a2ui-*` light variant values

Light counterpart to current dark values. Symmetric inversion of brightness, preserving brand-blue primary:

| Token | Dark (current) | Light (new) |
|---|---|---|
| `--a2ui-primary` | `#4f8df5` | `#4f8df5` (unchanged — brand blue works on both) |
| `--a2ui-on-primary` | `#ffffff` | `#ffffff` |
| `--a2ui-primary-hover` | `#6699f7` | `#3a78e0` |
| `--a2ui-secondary` | `#8a92a3` | `#5f6470` |
| `--a2ui-on-secondary` | `#ffffff` | `#ffffff` |
| `--a2ui-surface` | `#1a1d23` | `#ffffff` |
| `--a2ui-on-surface` | `#ffffff` | `#1a1d23` |
| `--a2ui-surface-variant` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.04)` |
| `--a2ui-on-surface-variant` | `rgba(255,255,255,0.7)` | `rgba(0,0,0,0.6)` |
| `--a2ui-outline` | `rgba(255,255,255,0.1)` | `rgba(0,0,0,0.12)` |
| `--a2ui-outline-variant` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.06)` |
| `--a2ui-error` | `#f5524f` | `#dc2626` |
| `--a2ui-on-error` | `#ffffff` | `#ffffff` |
| `--a2ui-scrim` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.4)` |
| `--a2ui-elevation-1..5` | `0 1-16px rgba(0,0,0,0.3-0.5)` | `0 1-16px rgba(0,0,0,0.06-0.18)` (lighter shadows for light bg) |

Spacing, typography, shape, motion, focus-ring stay the same (theme-invariant).

## Testing

**Unit:**
- Existing chat lib tests run unchanged (92 spec files) — no behavior changes outside CSS
- No new regression test for the bubble width fix (one-shot CSS change, low future-regression surface; E2E budget reserved for higher-value scenarios)

**Visual smoke (chrome MCP):**
- Cockpit on 3000, timeline pilot on 4507
- Submit "hello" — bubble width should match text, not wrap
- Submit a long message — bubble respects `max-width: 80%`, wraps at word boundaries
- Toggle to light — chat lib palette flips; verify a2ui surfaces (in `chat/a2ui` capability examples) are not white-on-near-black
- Toggle back to dark — symmetry verified

**Consumer build verification:**
- `examples/chat/angular` and `examples/chat/smoke/template` build clean after removing the `@import`

## Risks and mitigations

- **Dropping `chat.css` is a breaking API change.** Mitigated by 0.0.x patch bump signal + we control all known consumers. Anyone importing `@ngaf/chat/chat.css` externally will get a resolve error; the fix is to drop the import (tokens resolve via TS auto-injection).
- **`width: fit-content` browser support.** Safari ≥14, Chrome ≥57, Firefox ≥94 (after `-moz-fit-content` fallback). All modern targets covered.
- **a2ui-* light variant changes visual** for anyone running cockpit/chat/a2ui examples in light mode. Currently broken (white-on-near-black); fix is strict improvement.
- **The `@layer ngaf-chat` priority** depends on consumers not using `@layer` higher in the cascade. If a consumer has their own unnamed-layer rule overriding `--ngaf-chat-*`, the named layer (`ngaf-chat`) loses. Acceptable — consumers who define their own layers know what they're doing.

## Out-of-scope follow-ups (track but defer)

- Visual unification with `--ds-*` palette — PR 3
- `image.component.ts` chained `[style.*]` bindings → single binding refactor
- `chat-message.component.spec.ts` broader layout test coverage (only adding single-word regression here)
- ARIA polish on other a2ui catalog components beyond modal (audit pass to be done if needed)
