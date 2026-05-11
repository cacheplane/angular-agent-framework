# Chat Debug Shadcn Polish — Design

**Date:** 2026-05-11
**Status:** Approved — ready for implementation plan
**Surface:** `libs/chat` (`@ngaf/chat`), no consumer changes required
**Predecessor:** [2026-05-11-chat-debug-devtools-design.md](2026-05-11-chat-debug-devtools-design.md)
**Predecessor PR:** [#249](https://github.com/cacheplane/angular-agent-framework/pull/249)

## Summary

The merged `<chat-debug>` works, but its visual chrome reads as "raw" —
hairline borders, light-themed surface, generic gear-icon launcher,
button-style toggles. The control palette deleted in
[PR #244](https://github.com/cacheplane/angular-agent-framework/pull/244)
established a different, more polished design language for this product's
dev tooling: persistent dark zinc-900 surface with shadcn conventions,
status-pill collapsed state, real switch component, custom select triggers,
mount animation. This work aligns chat-debug with that language.

The slot API and public component surface are unchanged. This is purely a
visual refresh plus one primitive swap (`<chat-debug-toggle>` →
`<chat-debug-switch>`).

## Goals

- **Persistent dark devtools chrome** by default, regardless of host theme —
  matches every other devtool (Chrome, React, Redux) and the deleted
  palette v2.
- **Token escape hatch:** all chrome consumes `--ngaf-chat-debug-*` tokens
  with shadcn-zinc defaults. Hosts that care can override.
- **Status-pill launcher** with reactive streaming indicator.
- **Visual primitives aligned with palette v2:** custom select trigger,
  sliding switch, mount animation, 11px tracked uppercase section labels.
- **No new public-API concepts** beyond the toggle→switch swap.

## Non-goals

- No model/mode content in the launcher pill. Host puts those in the
  controls slot.
- No `chat-debug-toggle` deprecation period — it has no real consumer.
  Removed outright.
- No new test surface beyond updating the primitives smoke spec.
- No documentation page for the new tokens beyond an inline comment block.

## Token namespace

New file: `libs/chat/src/lib/compositions/chat-debug/chat-debug-tokens.ts`

```ts
export const CHAT_DEBUG_TOKENS = `
  :host {
    --ngaf-chat-debug-bg: #18181b;
    --ngaf-chat-debug-bg-deep: #09090b;
    --ngaf-chat-debug-surface: #1f1f23;
    --ngaf-chat-debug-border: #27272a;
    --ngaf-chat-debug-border-strong: #3f3f46;
    --ngaf-chat-debug-text: #fafafa;
    --ngaf-chat-debug-text-muted: #a1a1aa;
    --ngaf-chat-debug-text-subtle: #71717a;
    --ngaf-chat-debug-accent: #4f8df5;
    --ngaf-chat-debug-success: #4ade80;
    --ngaf-chat-debug-shadow-panel: 0 8px 32px rgba(0, 0, 0, 0.5);
    --ngaf-chat-debug-shadow-pill: 0 6px 18px rgba(0, 0, 0, 0.4);
    --ngaf-chat-debug-radius-panel: 12px;
    --ngaf-chat-debug-radius-input: 8px;
    --ngaf-chat-debug-radius-pill: 999px;
    --ngaf-chat-debug-font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  }
`;
```

Imported at the top of every chat-debug component / primitive's `styles`
array. Hosts override by setting any token on `chat-debug` or any
ancestor element.

All chat-debug components stop reading `--ngaf-chat-*` chat tokens. Pure
isolation: the chat library's theme and chat-debug's chrome are
independent token surfaces from this work forward.

## Launcher (status pill)

When `open() === false`, render a small rounded-pill at
`position: fixed; bottom: 20px; right: 20px`:

- ~36px tall, ~36px wide (just the dot — content can grow later).
- Background `--ngaf-chat-debug-bg`, border `--ngaf-chat-debug-border`,
  shadow `--ngaf-chat-debug-shadow-pill`.
- Hover background lifts to `--ngaf-chat-debug-surface`.
- Content: an 8px `.launcher__dot` element.
  - Default color `--ngaf-chat-debug-success` (green) with a faint glow.
  - When `agent.status() === 'running'`, color `--ngaf-chat-debug-accent`
    (blue) with stronger glow and the `chat-debug-pill-pulse` keyframe
    (1.2s, scale 1 → 0.85 → 1, opacity 1 → 0.6 → 1).
- ARIA: `<button aria-label="Open chat debug" aria-pressed="false">`.
- The gear icon is removed entirely.

## Panel chrome

Dock positions (right/bottom/left), persistence, slot API, tab strip —
all unchanged from the merged design.

Visual changes:

- All token references swap to `--ngaf-chat-debug-*`.
- Background `--bg`, border `--border`, shadow `--shadow-panel`, radius
  `--radius-panel` (12px) but only on the corners that aren't flush with
  the viewport edge (right dock: rounds top-left + bottom-left).
- Mount animation: `chat-debug-panel-enter` keyframe — `scale(0.96)` +
  `opacity: 0` → `scale(1)` + `opacity: 1`, 120ms ease.
  `transform-origin` chosen by dock: `right` → top-right, `left` →
  top-left, `bottom` → bottom-right. The single canonical origin matches
  the launcher position (bottom-right) — the panel appears to "grow out
  of" the launcher's location.
- Header drops the green dot added in the polish pass — the launcher pill
  is now the canonical status indicator.
- Header dock toggle group: track on `--bg-deep`, active button lifted to
  `--bg` (background) and tinted `--text` color, close button hover
  background `--surface`.

## Click-outside dismiss

When the panel is open, a `HostListener('document:click')` listens for
clicks anywhere. If `event.composedPath()` contains neither the panel
nor the launcher, the panel closes via the same path as the explicit
close button (emits `openChange`).

ESC behavior unchanged.

## Primitives — refresh

### `<chat-debug-section>`

- Padding `14px 16px`.
- Label: 11px, `font-weight: 600`, `letter-spacing: 0.04em`,
  `text-transform: uppercase`, color `--text-subtle`, margin
  `0 0 10px`.
- Body gap `var(--ngaf-chat-space-2)` stays — uses the existing chat
  spacing token (these tokens are still useful for rhythm; not the
  *visual* token problem).

### `<chat-debug-segmented>`

- Track: background `--bg-deep`, border `--border`, radius
  `--radius-input` (8px), padding `3px`.
- Buttons: flex 1, padding `6px 8px`, radius 5px (calc derived: input
  radius − padding), color `--text-muted`, font-size 12px.
- Hover (inactive): background `--bg`, color `--text`.
- Active: background `--border` (the `#27272a` lifted surface for the
  selected segment), color `--text`, font-weight 500.

### `<chat-debug-select>`

Replace the native chevron with palette v2's trigger pattern:

```html
<label>
  <span>{{ label() }}</span>
  <span class="select">
    <span class="select__value">{{ currentLabel() }}</span>
    <span class="select__caret">▾</span>
    <select [value]="value()" (change)="onChange($event)">
      @for (opt of options(); track opt.value) {
        <option [value]="opt.value">{{ opt.label }}</option>
      }
    </select>
  </span>
</label>
```

- `.select` is the styled trigger: background `--bg-deep`, border
  `--border`, radius `6px`, padding `6px 10px`, font 12px, min-width
  140px, color `--text`.
- `.select__caret` is `--text-subtle`, 10px.
- The actual `<select>` is positioned `absolute; inset: 0;` with
  `opacity: 0; cursor: pointer` — keeps native keyboard a11y and OS
  dropdown chrome, but the visual chrome is fully ours.
- `currentLabel()` is a computed: `options().find(o => o.value === value())?.label ?? value()`.
- Focus state: `.select:focus-within` gets `border-color: --accent` and
  `outline: 2px solid color-mix(in srgb, --accent 30%, transparent)`.

### `<chat-debug-toggle>` — **deleted**

No external consumer in the worktree or the example app. Removed from
`public-api.ts`.

### `<chat-debug-switch>` — **new**

Replaces `<chat-debug-toggle>` in the public surface.

API: identical to the old toggle:

- `label = input.required<string>()`
- `value = input.required<boolean>()`
- `valueChange = output<boolean>()`

Visual:

- Track: 36×20px, radius 999px, background `--border` when off,
  `--accent` when on. Transition `background 150ms ease`.
- Thumb: 16×16px, `top: 2px; left: 2px`, background `--text`, radius
  50%, box-shadow `0 1px 3px rgba(0, 0, 0, 0.5)`. When on,
  `transform: translateX(16px)`. Transition `transform 150ms ease`.
- ARIA: `role="switch"`, `aria-checked` reflects `value()`,
  `aria-label="{{ label() }}"`.

Label sits inline to the left of the track in a row layout.

### `<chat-debug-action>`

- Background `--bg`, color `--text`, border 1px `--border-strong`,
  radius `--radius-input`, padding `8px`, font-size 13px,
  font-weight 500, full width, centered.
- Hover background `--surface`.
- Active `translateY(1px)` (existing micro-interaction kept).

## Inspectors — refresh

Both inspectors swap their token references; structural HTML and behavior
unchanged.

- Timeline header: background `--bg-deep`, border `--border`, text
  `--text-muted`, count badge background `--surface` with `--border`
  outline.
- Timeline row hover-actions: background `--bg`, border `--border`,
  hover border `--border-strong`.
- Timeline diff card: background `--bg-deep`, border `--border`,
  radius `--radius-input`.
- Timeline empty state text: `--text-subtle`.
- State header: same treatment as timeline header.
- State copy button: same treatment as row-action buttons. Success
  state border becomes `--success`.

## File map

**New**

- `libs/chat/src/lib/compositions/chat-debug/chat-debug-tokens.ts`
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-switch.component.ts`

**Modified**

- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` —
  swap token references, add status-pill launcher, mount animation,
  click-outside dismiss, drop header dot.
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-section.component.ts` — token swap + label refinements.
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-segmented.component.ts` — token swap + visual refresh.
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-select.component.ts` — token swap + trigger redesign + `currentLabel` computed.
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-action.component.ts` — token swap + visual refresh.
- `libs/chat/src/lib/compositions/chat-debug/primitives/primitives.spec.ts` — drop toggle smoke test; add switch smoke test.
- `libs/chat/src/lib/compositions/chat-debug/inspectors/timeline-inspector.component.ts` — token swap.
- `libs/chat/src/lib/compositions/chat-debug/inspectors/state-inspector.component.ts` — token swap.
- `libs/chat/src/public-api.ts` — drop `ChatDebugToggleComponent` export, add `ChatDebugSwitchComponent`.

**Deleted**

- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-toggle.component.ts`

## Public-API delta

```diff
-export { ChatDebugToggleComponent } from './lib/compositions/chat-debug/primitives/chat-debug-toggle.component';
+export { ChatDebugSwitchComponent } from './lib/compositions/chat-debug/primitives/chat-debug-switch.component';
```

No type renames. No other surface changes.

## Behavior summary

- Persistence (open/dock/tab): unchanged.
- Slot API (`chatDebugControls`, `chatDebugInspector`): unchanged.
- Keyboard nav in Timeline (↑/↓/Home/End/Enter): unchanged.
- ESC close: unchanged.
- New: click-outside-when-open close.
- New: launcher dot reflects `agent.status() === 'running'`.

## Testing

- Update `primitives.spec.ts`: replace the toggle test with a switch test
  (defined-as-class).
- Add no other tests — visual changes; existing chat-debug.component.spec,
  persistence.spec, timeline-inspector.spec still cover behavior.
- Verify in browser at `localhost:4201` (worktree dev server):
  - Launcher is a green-dot pill at bottom-right.
  - Click opens a dark zinc-900 panel with mount animation.
  - Clicking outside closes it.
  - Send a message; pill dot turns blue and pulses while streaming.
  - All controls render with the new chrome.

## Out of scope (deferred)

- Model/mode display in the launcher pill (could land later if useful).
- Hover-state preview of pill contents (e.g., the model name appearing on
  pill hover).
- Switch variant primitives (e.g., 3-state switch). The current binary
  switch covers the design need.
- `--ngaf-chat-debug-*` documentation page on the website. Inline comment
  in `chat-debug-tokens.ts` is sufficient given the small adoption surface.
