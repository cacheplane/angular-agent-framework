# Chat surface polish — Design

**Status:** Approved
**Date:** 2026-05-17
**Goal:** Three chat-surface tweaks that complete the demo UX polish pass — reduce suggestion footprint to a single chip, add a scroll fade above the input, and increase the message-actions bar padding.

## Why now

Sub-project B of the demo UX polish pass. Sub-project A (sidenav) shipped in PR #399 and is live on `demo.cacheplane.ai`. The remaining three items the user flagged from the production review:

- **Suggestion list** still occupies more space than warranted. With sub-project A's sidenav now drawing the eye correctly, the suggestions are next to compress.
- **Abrupt line** between scrolling chat content and the input bar is jarring.
- **Message-actions bar** sits too tightly under each assistant message.

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Suggestions layout | **One featured chip + "More prompts" dropdown** in a single horizontal row, centered under the chat input |
| Featured chip source | `FEATURED_SUGGESTIONS[0]` — the first array entry. Consumer-controlled. Text trims with ellipsis if needed. |
| Canonical demo's featured prompt | "Demo: render a contact form" — the GenUI surface showcase is the most differentiating capability of @ngaf/chat |
| Scroll fade | 32px gradient mask above the chat input |
| Message-actions padding | 16px top / 12px bottom |
| Layout responsiveness | Pill respects container width via `max-width` + ellipsis. No new viewport breakpoints. |

## Architecture

### Item 3 — Single featured chip + dropdown

`WelcomeSuggestionsComponent` (in `examples/chat/angular/src/app/modes/`) was added in PR #383 to render `FEATURED_SUGGESTIONS` (3 chips) + `MORE_SUGGESTIONS` (14 chips in a dropdown). This spec reduces FEATURED to render only its first entry as a single chip, with everything else (FEATURED[1..] + all of MORE_SUGGESTIONS) consolidated into the dropdown.

Two implementation paths:
1. **Trim FEATURED_SUGGESTIONS to a single entry** in `welcome-suggestions.ts` (data change), keep the component reading `FEATURED_SUGGESTIONS[0]`.
2. **Keep FEATURED_SUGGESTIONS as a 3-entry list** but the component renders only `featured[0]` and merges `featured[1..] ++ more` into the dropdown options.

We pick #2. Rationale: the data file's intent (group of curated entries) stays consistent for any future consumer that wants to feature multiple chips. The component owns the "show only the first" presentation decision.

Layout: single horizontal flex row, centered, gap 12px. Pill uses `max-width: 380px` + `text-overflow: ellipsis` so long labels truncate. Dropdown trigger ("More prompts ⌄") is a borderless text-button (subtler than today's bordered chat-select trigger).

The canonical demo's `FEATURED_SUGGESTIONS` array gets reordered so "Demo: render a contact form" is at index 0.

### Item 4 — Scroll fade above input

Chat input lives at the bottom of the chat surface. The scrollable message-list above it currently abuts the input with no visual transition.

Add a 32px-tall gradient mask layer between the message list and the input: `linear-gradient(180deg, transparent 0%, var(--ngaf-chat-bg) 100%)`. Absolutely positioned, anchored to the top edge of the input region, with `pointer-events: none` so it doesn't block clicks.

The mask is rendered by `chat-window` or `chat-input` — whichever owns the bottom-anchored input chrome. Inspection needed; lib-side change in either case.

### Item 5 — Message-actions bar padding

`chat-message-actions` primitive (libs/chat) wraps the refresh/copy/thumbs row. Current vertical padding is ~4px. Increase to 16px top / 12px bottom via the component's CSS.

The 16px above separates the action row from the message bubble it belongs to; the 12px below separates it from the next message in the stream.

## Files touched

### Demo

- `examples/chat/angular/src/app/modes/welcome-suggestions.ts` — reorder `FEATURED_SUGGESTIONS` so the contact-form prompt is at index 0
- `examples/chat/angular/src/app/modes/welcome-suggestions.component.ts` — render only `featured[0]` as the single chip; merge `featured[1..] ++ more` into the dropdown options
- `examples/chat/angular/src/app/modes/welcome-suggestions.component.spec.ts` — update existing tests; add new cases for the single-chip behavior

### Library

- `libs/chat/src/lib/primitives/chat-message-actions/` (component file + spec + styles) — increase padding to 16/12
- `libs/chat/src/lib/primitives/chat-window/chat-window.component.ts` — template gains a `<div class="chat-window__scroll-fade" aria-hidden="true">` element as the **first child of `.chat-window__footer`**. Mask uses `--ngaf-chat-bg` so it works in both themes.
- `libs/chat/src/lib/styles/chat-window.styles.ts` — add `position: relative` to `.chat-window__footer` and add the new `.chat-window__scroll-fade` rule

### Out of scope
- Bigger suggestion redesign (e.g. dropdown becomes a slide-down panel)
- Animating the fade in/out on scroll position
- Per-message-type action bar variants
- Sidenav polish (sub-project A, already shipped)

## Visual treatment

### welcome-suggestions.component.ts template

```html
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
```

```css
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
```

Component class:

```ts
protected readonly featuredOne = FEATURED_SUGGESTIONS[0];
protected readonly moreOptions: readonly ChatSelectOption[] = [
  ...FEATURED_SUGGESTIONS.slice(1),
  ...MORE_SUGGESTIONS,
].map((s) => ({ value: s.value, label: s.label }));
```

### Scroll fade

```css
.chat-window__footer {
  position: relative; /* anchor for the scroll-fade overlay */
}
.chat-window__scroll-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%; /* sits directly above the footer's top edge */
  height: 32px;
  background: linear-gradient(180deg, transparent 0%, var(--ngaf-chat-bg) 100%);
  pointer-events: none;
}
```

Placing the fade element as the first child of `.chat-window__footer` and anchoring with `bottom: 100%` keeps the mask glued to the footer's top edge regardless of input height — no CSS variable plumbing required.

### Message-actions padding

```css
.chat-message-actions {
  padding-top: 16px;
  padding-bottom: 12px;
}
```

(replacing the current ~4px values).

## Testing

### Unit

- `welcome-suggestions.component.spec.ts` — UPDATE existing tests to assert: (a) one chip rendered (not 3); (b) dropdown options count = `FEATURED_SUGGESTIONS.length - 1 + MORE_SUGGESTIONS.length`; (c) clicking chip emits `(selected)` with `FEATURED_SUGGESTIONS[0].value`
- `chat-message-actions.component.spec.ts` — ADD a CSS-string assertion that the `.chat-message-actions` rule sets `padding-top: 16px` and `padding-bottom: 12px`
- `chat-window.component.spec.ts` (or wherever the fade is added) — ADD assertion that the gradient-mask element is rendered

### Manual smoke

- Suggestion row centers under the input on wide viewports; single chip + dropdown visible
- Long pill labels truncate with ellipsis (test by feeding a 200-char featured prompt)
- Scrolling chat content fades into the input area; no abrupt edge
- Message actions sit ~16px below the bubble and ~12px above the next message

## References

- Prior sub-project A spec: `docs/superpowers/specs/2026-05-17-sidenav-polish-design.md`
- Welcome-suggestions component (added in PR #383): `examples/chat/angular/src/app/modes/welcome-suggestions.component.ts`
- Visual mockup: `.superpowers/brainstorm/33646-1779031519/content/scroll-fade-and-actions.html`
