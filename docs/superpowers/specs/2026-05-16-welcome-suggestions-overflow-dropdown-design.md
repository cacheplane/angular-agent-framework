# Welcome suggestions — top-3 + overflow dropdown — Design

**Status:** Approved
**Date:** 2026-05-16
**Goal:** Reduce the welcome-state visual footprint in the canonical demo by surfacing 3 representative suggestion chips above the fold and tucking the remaining 14 into a dropdown styled like the existing model picker.

## Why now

The demo's welcome state currently renders 17 suggestion chips stacked vertically, occupying ~360px of vertical space at the bottom of the page. A first-time visitor sees a wall of options instead of a focused choose-this-or-type-something experience. The user flagged this directly on the production demo at https://demo.cacheplane.ai/embed after the v0.0.35 chrome restoration.

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Visible "top" count | **3** |
| Top-3 selection | **Curated trio** — one each of: markdown/streaming, tool use, GenUI surface |
| Dropdown action | **Auto-send** — selecting a prompt immediately submits, matching chip click |
| Dropdown trigger label | **"More prompts"** |
| Scope | Demo-side only; no changes to `@ngaf/chat` lib API |
| Layout | Flex-wrap row of chips above; dropdown on its own line below |

## The curated trio

```ts
export const FEATURED_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  // 1. Markdown / streaming showcase
  { label: 'Tell me about coral reefs',
    value: 'Tell me about coral reefs' },

  // 2. Tool use + citations
  { label: 'What are Angular signals? (search + cite sources)',
    value: 'Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite each source inline as [^doc-id] using the document `id` field returned by the tool.' },

  // 3. GenUI surface
  { label: 'Demo: render a contact form',
    value: 'Show me a contact form with fields for name, email address, subject, and a multi-line message, plus a Send button.' },
];
```

Each pick exercises a distinct capability path the chat lib advertises. A first-time visitor sees breadth in one glance.

## Architecture

Pure demo-side composition. Reuses two existing chat-lib primitives:
- `<chat-welcome-suggestion>` — renders each chip (already used by the demo)
- `<chat-select>` — renders the dropdown trigger + popover (same primitive the model picker uses inside `<chat-input>`)

The new piece is a tiny standalone Angular component that wraps both:

```ts
@Component({
  selector: 'welcome-suggestions',
  standalone: true,
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
        (valueChange)="selected.emit($event)"
      />
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .welcome-suggestions__featured {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }
  `],
})
export class WelcomeSuggestionsComponent {
  readonly selected = output<string>();
  protected readonly featured = FEATURED_SUGGESTIONS;
  protected readonly moreOptions: ChatSelectOption[] =
    MORE_SUGGESTIONS.map(s => ({ value: s.value, label: s.label }));
}
```

## Data layer

`examples/chat/angular/src/app/modes/welcome-suggestions.ts` splits the existing flat `WELCOME_SUGGESTIONS` const into two:

```ts
export interface WelcomeSuggestion {
  readonly label: string;
  readonly value: string;
}

export const FEATURED_SUGGESTIONS: readonly WelcomeSuggestion[] = [ /* the curated 3 */ ];
export const MORE_SUGGESTIONS:     readonly WelcomeSuggestion[] = [ /* the remaining 14 */ ];

// Back-compat: keep the unified export so any third-party importer (none today)
// continues to work. Internal callers migrate to the split arrays.
export const WELCOME_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  ...FEATURED_SUGGESTIONS,
  ...MORE_SUGGESTIONS,
];
```

The remaining 14 entries are the existing prompts minus the 3 promoted to FEATURED. Order is preserved (no reshuffling beyond removal).

## Consumer migration

Three mode components in `examples/chat/angular/src/app/modes/`:
- `embed-mode.component.ts`
- `popup-mode.component.ts`
- `sidebar-mode.component.ts`

Each currently has a `<div chatWelcomeSuggestions>` wrapper containing:

```html
@for (s of suggestions; track s.value) {
  <chat-welcome-suggestion [label]="s.label" [value]="s.value" (selected)="send($event)" />
}
```

Each gets replaced with a single line:

```html
<welcome-suggestions chatWelcomeSuggestions (selected)="send($event)" />
```

The `suggestions` field on each mode component class (which references `WELCOME_SUGGESTIONS`) is deleted — no longer needed.

## Behavior

| User action | Result |
|---|---|
| Click a chip | `(selected)` emits the chip's value → mode component calls `agent.submit({ message })` → welcome state unmounts as first message lands |
| Click dropdown trigger | Popover opens (chat-select's existing behavior); user sees 14 labels |
| Pick an option | `(valueChange)` fires → `(selected)` emits → same submit path. Auto-send. |
| Click outside the dropdown without picking | Popover closes; no emit; welcome state unchanged |

Because the welcome state unmounts on first submit (existing chat lib behavior, unchanged), the chat-select's internal "selected option" state never visually persists after a pick. No state reset is needed.

## Layout

- **Wide viewport** (≥768px): 3 chips wrap onto a single row, centered. Dropdown sits below, centered, on its own line.
- **Narrow viewport**: chips may wrap onto multiple rows. Dropdown stays on its own line below.

The host element uses `display: flex; flex-direction: column; align-items: center; gap: 12px;` to vertically stack the chip group and the dropdown. The chip group itself uses `display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;` to lay out the chips.

## Testing

`welcome-suggestions.component.spec.ts` — 4 vitest cases:

1. Renders 3 `<chat-welcome-suggestion>` instances with labels matching FEATURED_SUGGESTIONS
2. Renders one `<chat-select>` with `placeholder="More prompts"` and `options.length === MORE_SUGGESTIONS.length`
3. Clicking a chip emits `(selected)` with the chip's value
4. Picking from the dropdown emits `(selected)` with the option's value

Use `TestBed.createComponent(WelcomeSuggestionsComponent)` and assert via `fx.componentRef.outputs`. Reference patterns from `chat-welcome-suggestion.component.spec.ts`.

## Out of scope

- Adding this composition to `libs/chat` as a public primitive. Only one consumer today (the demo). Reconsider if a second consumer materializes.
- Search/filter inside the dropdown (chat-select doesn't support it; 14 items don't need it).
- Categorization (e.g. group by markdown / GenUI / tool-use). Could be added later if the list grows.
- Reordering the existing 14 demos in MORE_SUGGESTIONS. Out of scope; preserve current order.
- Animation on welcome-state mount/unmount.

## References

- `libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.ts` — the chip primitive
- `libs/chat/src/lib/primitives/chat-select/chat-select.component.ts` — the dropdown primitive (also used by the model picker)
- `examples/chat/angular/src/app/modes/welcome-suggestions.ts` — the current flat list
- `examples/chat/angular/src/app/modes/embed-mode.component.ts:30-37` — example of the existing `@for` pattern across all 3 modes
