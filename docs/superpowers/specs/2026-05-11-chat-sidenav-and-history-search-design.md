# Chat sidenav + history search — design

**Date:** 2026-05-11
**Surface:** `@ngaf/chat` (`libs/chat/`) — new composition + new primitive; hard-replaces existing `chat-thread-drawer` composition
**Status:** Design approved; ready for implementation plan
**Research input:** ChatGPT authenticated left-sidenav PRD (pasted by user)

## Summary

Add a single sidenav composition that consolidates the existing thread-drawer behavior, supports three responsive modes (expanded / collapsed / drawer), and exposes named projection slots for sections the framework does not own (projects, library, GPTs, apps, agents, group chats, account/profile). Add a separate modal history-search palette primitive driven by Cmd/Ctrl+K. Together these cover **Phase 1 (shell + threads)** and **Phase 2 (search)** of the larger PRD decomposition. All other PRD sections (archive, projects, library, etc.) are deferred to later phases.

This spec hard-replaces `chat-thread-drawer` rather than coexisting with it. The framework is pre-1.0 (0.0.x) and project policy is to break in patch releases without backward-compat shims.

## Goals

- Honest framework surface — express only what the framework can deliver today (threads + search). Everything else is consumer territory, exposed via named `<ng-content>` slots.
- One composition covers all three responsive modes. No drawer-only second class.
- Cmd/Ctrl+K opens a modal palette globally — works whether the sidenav is collapsed, in drawer-closed state, or not even rendered.
- Palette is "dumb" — consumer wires results, matching the existing primitive pattern (`chat-thread-list` takes `threads`, emits `threadSelected`).

## Non-goals (deferred to later phases)

- Archive semantics. No `status: 'active' | 'archived'` on the thread model.
- Per-row overflow menu (archive / delete / share / rename). Phase 3.
- Server-side or content search. Phase 3+; for now consumers wire whatever search they want.
- Projects, Library, GPTs, Apps, Agents, Group chats, Workspace switching, Temporary Chats as built-in framework concepts. These are consumer slots only.
- Persistence of expanded/collapsed state across reloads.
- A formal `SearchableAgent` interface.

## Scope split

Both phases ship in one branch / one PR. They are sequenced in implementation but tightly coupled (the sidenav emits `(searchOpened)`, the palette listens) — splitting them across PRs would force a temporary unwired state.

- **Phase 1:** `chat-sidenav` composition, hard-replace `chat-thread-drawer`, migrate examples-chat-angular.
- **Phase 2:** `chat-history-search-palette` primitive, Cmd+K wiring on the sidenav composition, default wiring in examples-chat-angular.

## File map

**New:**
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`
- `libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.ts`
- `libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.spec.ts`
- `libs/chat/src/lib/styles/chat-sidenav.styles.ts`
- `libs/chat/src/lib/styles/chat-history-search-palette.styles.ts`

**Deleted:**
- `libs/chat/src/lib/compositions/chat-thread-drawer/` (entire directory, including its `.spec.ts`)

**Modified:**
- `libs/chat/src/public-api.ts` — add new exports, remove drawer export
- `libs/chat/src/lib/styles/chat-tokens.ts` — add three width tokens to `SPACING_TOKENS`
- `examples/chat/angular/src/...` — migrate usages of `ChatThreadDrawerComponent` to `ChatSidenavComponent`; render `ChatHistorySearchPaletteComponent` in the shell; wire default client-side filter
- `apps/website/content/docs/chat/api/api-docs.json` — regenerated to reflect new exports / removed drawer

## `chat-sidenav` composition

### Inputs

- `agent: Agent` (required) — passed through to the inner thread list for thread-row rendering and active-thread highlighting
- `mode: 'expanded' | 'collapsed' | 'drawer'` (default `'expanded'`)
- `open: boolean` (model, default `false`) — only meaningful when `mode === 'drawer'`
- `threads: Thread[] | null` (default `null`) — if `null`, the threads section is suppressed and the consumer is expected to project their own thread rendering via `[sidenavSections]`
- `activeThreadId: string | null` (default `null`)

`Thread` is the existing type already consumed by `chat-thread-list` (do not redefine).

### Outputs

- `(newChat: void)` — new-chat button clicked
- `(threadSelected: string)` — thread id; relayed from inner `chat-thread-list`
- `(searchOpened: void)` — search button clicked OR Cmd/Ctrl+K fired
- `(openChange: boolean)` — drawer-mode open state changed

### Layout (expanded)

```
┌─ chat-sidenav (data-mode="expanded") ──┐
│ <ng-content select="[sidenavHeader]"/> │   branding/logo slot
├────────────────────────────────────────┤
│ [+ New chat]   [🔍 Search]             │   built-in actions row
├────────────────────────────────────────┤
│ <ng-content select="[sidenavPrimary]"/>│   consumer destinations
├────────────────────────────────────────┤
│ Recent                                 │
│   <chat-thread-list ...>               │   built-in, only if threads !== null
├────────────────────────────────────────┤
│ <ng-content select="[sidenavSections]"/>│  consumer sections (projects/etc.)
├────────────────────────────────────────┤
│ <ng-content select="[sidenavAccount]"/>│   sticky bottom slot
└────────────────────────────────────────┘
```

### `collapsed` mode

- Same vertical order, ~56 px wide rail.
- Built-in buttons render icon-only (no labels). `aria-label` and `title` provided.
- Consumer-supplied slot content is expected to render compact; the composition sets `[data-mode="collapsed"]` on the host so consumer styles can target it.
- Threads section renders avatar/initial-letter chips of recent threads (clickable). Limit: 5 most recent. Overflow hidden — the only way to see older threads in collapsed mode is to open search or expand.

### `drawer` mode

- Overlay variant. Subsumes the deleted `chat-thread-drawer`.
- Scrim (`button` element so it is keyboard-focusable for click-to-close).
- Focus trap while open: tab is confined to elements inside the drawer.
- Esc closes; emits `(openChange, false)`.
- On open, focus moves to the new-chat button.
- On close, focus returns to the invoking element (consumer is responsible for triggering the drawer from a focusable invoker; framework restores focus via storing `document.activeElement` at open-time).
- Full width on viewports `≤ 767 px`; otherwise uses `--ngaf-chat-sidenav-width-drawer`.

### CSS tokens (added to `SPACING_TOKENS` in `chat-tokens.ts`)

```css
--ngaf-chat-sidenav-width-expanded: 280px;
--ngaf-chat-sidenav-width-collapsed: 56px;
--ngaf-chat-sidenav-width-drawer: 280px;
```

### Keyboard shortcut

- Lives on `chat-sidenav`'s constructor (NOT a separate global directive).
- `fromEvent(window, 'keydown').pipe(takeUntilDestroyed(destroyRef))`.
- Matches `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'`.
- On match: `e.preventDefault()`; `this.searchOpened.emit()`.
- Suppressed when `e.target` is `<input>`, `<textarea>`, or `contenteditable`.
- Suppressed implementation note: the composition does NOT know if the palette is already open. The consumer can choose to ignore re-emits if it wants. The palette itself does not auto-close on Cmd+K (it would be a no-op anyway since the input would swallow it once focused).
- The shortcut fires even when the sidenav is in `collapsed` or `drawer` mode — it is a global trigger.

## `chat-history-search-palette` primitive

### Type

```ts
export interface ThreadMatch {
  id: string;
  title: string;
  /** Optional secondary line (e.g. last-message snippet). Renders muted. */
  subtitle?: string;
}
```

### API

Inputs:
- `open: boolean` (model, default `false`)
- `query: string` (model, default `''`)
- `results: ThreadMatch[]` (default `[]`)
- `loading: boolean` (default `false`)
- `placeholder: string` (default `'Search conversations'`)

Outputs:
- `(threadSelected: string)`
- `(close: void)`

### DOM shape

```
[scrim (button)]
  └─ [dialog]
       ├─ [input row]   icon + <input> + close button
       └─ [list / empty / loading state]
```

Absolutely-positioned inside the host's view (no Angular CDK Portal). Fixed to viewport, `z-index: 50`. Width capped at `min(560px, 90vw)`.

### Behavior

- On `open` transitioning false → true: focus the input on next microtask; set `activeIndex = 0`.
- On `open` transitioning true → false: no internal side effects (consumer owns the signal).
- **Esc**: emit `(close)`. Do NOT clear `query`.
- **ArrowDown / ArrowUp**: move `activeIndex` within `[0, results.length - 1]`. Clamp at ends (no wrap-around).
- **Enter**: if `results.length > 0`, emit `(threadSelected, results[activeIndex].id)`. No-op if empty.
- **Click on scrim**: emit `(close)`.
- **Click on result row**: emit `(threadSelected, row.id)`.
- **Click on close button (✕ in input row)**: emit `(close)`.

### Rendered states

| Condition                                              | Renders                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| `loading && results.length === 0`                      | Skeleton (3 muted rows)                  |
| `!loading && query === ''`                             | Muted hint "Type to search your conversations." |
| `!loading && query !== '' && results.length === 0`     | "No conversations match." empty state    |
| `!loading && results.length > 0`                       | Listbox of result rows                   |

### ARIA

- Dialog: `role="dialog"`, `aria-modal="true"`, `aria-label="Search conversations"`.
- Input: `role="combobox"`, `aria-expanded="true"`, `aria-controls="<list-id>"`, `aria-activedescendant="<active-row-id>"`. The input keeps DOM focus throughout; arrow keys move *virtual* focus via `aria-activedescendant`.
- List: `role="listbox"` with deterministic `id` (e.g. `chat-history-search-palette__results-{counter}`).
- Rows: `role="option"`, `aria-selected="true"` on the active row, `id="chat-history-search-palette__results-{counter}__row-{idx}"`.
- Scrim: `<button type="button" aria-label="Close search">`.

### Consumer-side debouncing

The palette does NOT debounce. It emits `query` on every keystroke via the two-way binding. The consumer chooses when to compute results. Default examples-chat-angular wiring debounces 150 ms via a `signal`-piped `setTimeout` or RxJS `debounceTime`.

## Migration: hard-replace `chat-thread-drawer`

### Before

```html
<chat-thread-drawer
  [threads]="threads()"
  [activeThreadId]="activeThreadId()"
  [open]="drawerOpen()"
  mode="overlay"
  (threadSelected)="selectThread($event)"
  (openChange)="drawerOpen.set($event)"
/>
```

### After

```html
<chat-sidenav
  [agent]="agent"
  [threads]="threads()"
  [activeThreadId]="activeThreadId()"
  [(open)]="drawerOpen"
  [mode]="sidenavMode()"
  (newChat)="onNewChat()"
  (threadSelected)="selectThread($event)"
  (searchOpened)="paletteOpen.set(true)"
>
  <!-- optional projections -->
</chat-sidenav>

<chat-history-search-palette
  [(open)]="paletteOpen"
  [(query)]="searchQuery"
  [results]="searchResults()"
  (threadSelected)="onSearchSelect($event)"
  (close)="paletteOpen.set(false)"
/>
```

Where `sidenavMode` is a `computed()` over viewport width:

```ts
readonly sidenavMode = computed<ChatSidenavMode>(() => this.isNarrow() ? 'drawer' : 'expanded');
```

`isNarrow()` derives from `window.matchMedia('(max-width: 767px)')` (set up in the shell's constructor with a listener).

### Public API surface

`libs/chat/src/public-api.ts`:
- **Add:**
  - `ChatSidenavComponent` (value + type alias `ChatSidenavMode`)
  - `ChatHistorySearchPaletteComponent`
  - `ThreadMatch` (type)
- **Remove:**
  - `ChatThreadDrawerComponent`, `ChatThreadDrawerMode`

## Edge cases

1. **Cmd+K while focus is in the palette's own input.** Suppression rule fires — palette stays open, no re-emit. Correct behavior.
2. **Sidenav mounted multiple times** (e.g. one in shell, one in a sub-route). The Cmd+K listener fires once per instance, so multiple emits go out. Acceptable — consumers ignoring duplicates is cheap; alternative (global registry) is complexity for a rare case.
3. **`threads` becomes `null` mid-render.** Threads section suppressed via `@if (threads() !== null)`; existing thread rows unmount cleanly.
4. **`drawer` mode opened while `mode` simultaneously changes to `expanded`.** Composition reacts to `mode` change first (signal effect), drawer transitions are CSS-driven and any in-flight transition completes. Visible flicker possible but minor; not worth special-casing.
5. **First render in `drawer` mode with `open=true`.** Focus moves to new-chat button. Stored "invoker" is whatever had focus when the drawer opened — may be `body` if the page just loaded; in that case restoring focus on close is a no-op, which is fine.

## Testing

### Unit / component

`chat-sidenav.component.spec.ts`:
- Renders correct `data-mode` attribute for each mode value.
- New-chat button click emits `(newChat)`.
- Search button click emits `(searchOpened)`.
- Cmd+K (synthesized `KeyboardEvent` with `metaKey: true, key: 'k'`) emits `(searchOpened)`.
- Cmd+K is NOT emitted when `e.target` is an `<input>` element.
- `threadSelected` is relayed from inner `chat-thread-list`.
- Drawer mode: Esc emits `(openChange, false)`.
- Drawer mode: scrim click emits `(openChange, false)`.

`chat-history-search-palette.component.spec.ts`:
- Empty-state hint renders when `query === ''` and not loading.
- "No conversations match." renders when `query !== ''` and results empty.
- Skeleton renders when `loading && results.length === 0`.
- Result list renders rows when results provided.
- ArrowDown moves `activeIndex`; clamps at `results.length - 1`.
- ArrowUp moves `activeIndex`; clamps at 0.
- Enter emits `(threadSelected, results[activeIndex].id)` when results non-empty.
- Enter is no-op when results empty.
- Esc emits `(close)`.
- Scrim click emits `(close)`.
- Row click emits `(threadSelected)` with the right id.
- Input has correct ARIA attributes (`role="combobox"`, `aria-controls`, `aria-activedescendant`).

### Manual (Chrome MCP) verification

1. Sidenav `expanded` — threads render, new-chat / search buttons work.
2. Sidenav `collapsed` — icon rail; tooltips present; layout intact.
3. Sidenav `drawer` (narrow viewport) — overlay, focus trap, Esc closes, focus returns to invoker.
4. Cmd+K (or Ctrl+K) opens the palette globally.
5. Type in palette — debounced 150 ms — filtered results appear.
6. ArrowDown/Up moves selection; Enter opens; Esc closes.
7. Hard-replaced `chat-thread-drawer` — no references remaining; examples-chat-angular renders correctly in all viewport widths.

## Performance considerations

- The Cmd+K listener uses `fromEvent(window, 'keydown')` with `takeUntilDestroyed` — no leak.
- The palette renders nothing when `open === false` (gated by `@if (open())` at the template root). Zero DOM cost when closed.
- The threads section in `chat-sidenav` is a thin wrapper over the existing `chat-thread-list` — no new virtualization concerns introduced.
- The consumer-side default debounce (150 ms) keeps client filter cost bounded.

## Accessibility checklist

- All built-in buttons have `aria-label` and visible focus rings (using `:focus-visible` + token color).
- Drawer mode: focus trap; Esc closes; focus returns to invoker.
- Palette: `aria-modal="true"`; arrow-key `aria-activedescendant` pattern; `aria-selected` on active row.
- Color contrast: all default colors use existing `--ngaf-chat-*` tokens, which already meet 4.5:1 on light and dark themes.
- Reduced motion: drawer slide-in transition is `200ms ease`; the framework does not currently honor `prefers-reduced-motion` globally — this spec does NOT add that handling (out of scope; would be a follow-up across all chat transitions).

## Open questions / assumptions

- **Verified:** `Thread` is exported from `chat-thread-list.component.ts` but NOT re-exported from `public-api.ts`. The implementation plan will add it to the barrel so consumers can type the `threads` input.
- **Assumption:** The existing `chat-thread-list` accepts `threads`, `activeThreadId`, and emits `threadSelected`. Plan will verify and adjust.
- **Open:** Whether the new-chat button should be hidden in `collapsed` mode in favor of an icon-only "+". Default per this spec: icon-only "+" in collapsed, full "New chat" label in expanded and drawer.
- **Open:** Whether the palette should support a "Recent searches" section above results when `query === ''`. Default: no — out of scope, hint only. Consumer can layer this on later if needed.
