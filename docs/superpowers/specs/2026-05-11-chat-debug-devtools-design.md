# Chat Debug Devtools — Design

**Date:** 2026-05-11
**Status:** Approved — ready for implementation plan
**Surface:** `libs/chat` (`@ngaf/chat`), with smoke-app migration in `examples/chat/angular`

## Summary

Repurpose `<chat-debug>` from a chat-bundled composition into a **floating
devtools launcher** for any `AgentWithHistory`. A developer drops one tag into
their app, gets observability (timeline + state inspector) plus a slot API for
host-extensible controls and inspector tabs. No chat surface is rendered; the
panel pairs with whatever chat the host already has.

The smoke app's bespoke `ControlPalette` and its bottom-overlay debug pane are
deleted; their controls move into a `chatDebugControls` template inside the
new `<chat-debug>`.

## Goals

- **Drop-in:** `<chat-debug [agent]="agent" />` is enough to get a working
  launcher.
- **Themed by default:** consumes existing `--ngaf-chat-*` tokens, so it
  inherits the host's chat theme.
- **Extensible:** host apps inject their own pinned controls and inspector
  tabs through a slot API built on `<ng-template>` structural directives.
- **Decoupled:** never renders a chat surface, never assumes a specific host
  layout. `position: fixed` panel; host's chat is unaffected.

## Non-goals (v1)

- Multiple agents per launcher. One agent, one launcher.
- Detach-to-window. Three dock positions only: `right` (default), `bottom`,
  `left`.
- Tabs in the controls zone. Controls are always a single pinned stack.
- A separate token namespace. We reuse `--ngaf-chat-*` directly.

## Component API

```html
<chat-debug
  [agent]="agent"
  [dock]="'right'"
  [defaultOpen]="false"
  [storageKey]="'chat-debug'"
  (replayRequested)="onReplay($event)"
  (forkRequested)="onFork($event)"
  (dockChange)="onDockChange($event)"
  (openChange)="onOpenChange($event)"
>
  <ng-template chatDebugControls>
    <chat-debug-section label="Mode">
      <chat-debug-segmented
        [options]="modeOptions"
        [value]="mode()"
        (valueChange)="onModeChange($event)"
      />
    </chat-debug-section>
    <chat-debug-section label="Agent">
      <chat-debug-select label="Model" [options]="modelOptions" [value]="model()" (valueChange)="onModelChange($event)" />
      <chat-debug-select label="Effort" [options]="effortOptions" [value]="effort()" (valueChange)="onEffortChange($event)" />
    </chat-debug-section>
    <chat-debug-section>
      <chat-debug-action label="New conversation" (clicked)="onNewConversation()" />
    </chat-debug-section>
  </ng-template>

  <ng-template chatDebugInspector label="Network">
    <my-network-inspector [agent]="agent" />
  </ng-template>
</chat-debug>
```

### Inputs

| Input | Type | Default | Notes |
|---|---|---|---|
| `agent` | `AgentWithHistory` (required) | — | Source for `history()` and `state()`. |
| `dock` | `'right' \| 'bottom' \| 'left'` | `'right'` | Initial dock; persisted thereafter. |
| `defaultOpen` | `boolean` | `false` | Used only when no persisted state exists. |
| `storageKey` | `string` | `'chat-debug'` | Prefix for all localStorage keys (`{storageKey}:dock`, `{storageKey}:open`, `{storageKey}:size`, `{storageKey}:tab`). |

### Outputs

| Output | Payload | Notes |
|---|---|---|
| `replayRequested` | `string` (checkpoint id) | Forwarded from timeline row action. |
| `forkRequested` | `string` (checkpoint id) | Forwarded from timeline row action. |
| `dockChange` | `'right' \| 'bottom' \| 'left'` | After user dock toggle. |
| `openChange` | `boolean` | After user open/close (including ESC). |

### Slots

Structural directives projected onto `<ng-template>`:

- `chatDebugControls` — **single** template. Rendered in the pinned top zone.
  If absent, the controls zone collapses to zero height.
- `chatDebugInspector` — **repeatable**, requires `label` input. Each becomes
  a tab appended after the built-in `Timeline` and `State` tabs.

### Public primitives

Each is a standalone component exported from `@ngaf/chat` for use inside
`chatDebugControls` (and reusable elsewhere if a host wants to):

| Component | Inputs | Outputs |
|---|---|---|
| `<chat-debug-section>` | `label?: string` | — |
| `<chat-debug-segmented>` | `options: {value, label}[]`, `value: string` | `valueChange` |
| `<chat-debug-select>` | `label: string`, `options: {value, label}[]`, `value: string` | `valueChange` |
| `<chat-debug-toggle>` | `label: string`, `value: boolean` | `valueChange` |
| `<chat-debug-action>` | `label: string` | `clicked` |

## Layout

### Launcher (closed state)

40×40px floating button, fixed at `bottom: 16px; right: 16px` regardless of
dock setting. Icon from existing `chat-icons`. Hover reveals "Open chat debug"
tooltip. z-index above chat content, below the existing interrupt overlay
(z-index 998).

### Docked panel (open state)

- `dock: 'right'` — `position: fixed; top: 0; right: 0; bottom: 0; width: 420px`. Left edge is a 4px drag handle for resize.
- `dock: 'bottom'` — `position: fixed; left: 0; right: 0; bottom: 0; height: 40vh`. Top edge is the drag handle.
- `dock: 'left'` — mirror of `right`.

Min size 320px / 25vh; max 60vw / 70vh.

### Panel chrome (top → bottom)

1. **Header.** Title "Chat Debug", dock-position toggle (three icons: ◧ ▭ ◨),
   close button. ~40px tall.
2. **Controls zone.** Renders the `chatDebugControls` template, if any.
   Scrolls internally on overflow. Hidden when no template is provided.
3. **Tab strip.** Built-in tabs: `Timeline`, `State`. Host `chatDebugInspector`
   tabs append after. The strip is hidden only in the degenerate case where
   exactly one tab is registered (i.e., never in v1, since both built-ins
   ship).
4. **Active inspector.** Fills remaining height; scrolls independently.

### Behavior

- Dock position, open state, panel size, and selected inspector tab all
  persist to `localStorage` under `{storageKey}:*`.
- `Esc` while focus is inside the panel closes it.
- The panel is `position: fixed` and does not reflow the host's layout.
  Hosts that want the chat to reflow next to a docked panel must do so
  themselves (with `padding-right`/`margin-right` on their layout container,
  reacting to `dockChange` if needed).

## Built-in inspectors

### Timeline tab (default)

Vertical list of checkpoints from `agent.history()`, oldest → newest.

Each row:
- Index badge.
- Short label derived from the last message's role + truncated content.
- Timestamp.
- Expand chevron. Click expands the row inline to show a state diff vs the
  previous checkpoint (current `state-diff.ts` rendering).
- On hover: **Replay** and **Fork** actions that emit `replayRequested` /
  `forkRequested` with the checkpoint id.

Header above the list: "{n} checkpoints" + a "clear selection" link.

Keyboard:
- `↑`/`↓` — move selection.
- `Enter` — expand/collapse the selected row.
- `Home`/`End` — jump to first/last.

### State tab

- Current `agent.state()` rendered as a collapsible JSON tree (reuse
  `debug-state-inspector`).
- Search input at top filters keys.
- Copy button copies the JSON payload to clipboard.

## File structure

Under `libs/chat/src/lib/compositions/chat-debug/`:

**New / restructured**

- `chat-debug.component.ts` — launcher + docked panel chrome (replaces
  current implementation).
- `chat-debug-controls.directive.ts` — `[chatDebugControls]` structural
  directive marker.
- `chat-debug-inspector.directive.ts` — `[chatDebugInspector]` structural
  directive with `label` input.
- `primitives/chat-debug-section.component.ts`
- `primitives/chat-debug-segmented.component.ts`
- `primitives/chat-debug-select.component.ts`
- `primitives/chat-debug-toggle.component.ts`
- `primitives/chat-debug-action.component.ts`
- `inspectors/timeline-inspector.component.ts` — vertical list + inline diff
  + keyboard nav; wraps existing checkpoint card and state-diff rendering.
- `inspectors/state-inspector.component.ts` — wraps existing
  `debug-state-inspector` for the State tab.
- `persistence.ts` — typed `localStorage` wrapper with `{storageKey}:*`
  namespacing.

**Survives, re-wired under new chrome**

- `debug-checkpoint-card.component.ts`
- `debug-state-diff.component.ts`
- `debug-state-inspector.component.ts`
- `debug-utils.ts`
- `state-diff.ts`

**Removed**

- `debug-controls.component.ts` — step buttons replaced by keyboard +
  click selection.
- `debug-summary.component.ts` — count moves into the timeline header.
- `debug-detail.component.ts` — detail moves inline into the expanded
  timeline row.

## Public exports from `@ngaf/chat`

- `ChatDebugComponent`
- `ChatDebugControlsDirective`
- `ChatDebugInspectorDirective`
- `ChatDebugSectionComponent`
- `ChatDebugSegmentedComponent`
- `ChatDebugSelectComponent`
- `ChatDebugToggleComponent`
- `ChatDebugActionComponent`

## Styling and tokens

The panel consumes existing `--ngaf-chat-*` tokens directly
(`--ngaf-chat-bg`, `--ngaf-chat-text`, `--ngaf-chat-text-muted`,
`--ngaf-chat-separator`, `--ngaf-chat-surface-alt`, `--ngaf-chat-radius-card`,
spacing tokens). No new token namespace is introduced. The launcher button
uses `--ngaf-chat-primary` for its background.

A host with the A2UI theme system installed gets the panel themed
automatically; a host without it gets the chat library's default token
values. The tokens themselves are independent of A2UI surface implementation.

## Smoke app migration

In `examples/chat/angular`:

**Replace** the `<app-control-palette>` element and the
`.demo-shell__debug` overlay block in
[demo-shell.component.html](examples/chat/angular/src/app/shell/demo-shell.component.html)
with a single `<chat-debug>` instance whose `chatDebugControls` template
houses the existing mode/model/effort/genUI/theme/new-conversation controls
using the new primitives.

**Delete**

- `examples/chat/angular/src/app/shell/control-palette.component.{ts,html,css}` and its spec.
- `examples/chat/angular/src/app/shell/palette-persistence.service.{ts,spec.ts}`.
- The "Debug on/off" toggle (chat-debug owns its open state).
- The `.demo-shell__debug` fixed-bottom overlay style block.

**Survives**

- Threads drawer (left side, orthogonal).
- Interrupt panel + subagents overlays (orthogonal).
- Mode routing (`embed` / `popup` / `sidebar`) — still drives the
  `<router-outlet>`. Mode picker now lives in chat-debug controls.

## Testing

- Unit specs per primitive covering input/output contract and a11y
  attributes (`aria-pressed`, `role="tab"`, label association on selects).
- `chat-debug.component.spec.ts`: open/close, dock cycling, persistence
  round-trip, slot projection (controls present / absent), tab strip
  rendering rules (hidden with one tab, visible with two+), ESC close.
- `timeline-inspector.spec.ts`: keyboard navigation, replay/fork emission,
  selection state, inline diff rendering on expand.
- Smoke pass: rerun `examples-chat-smoke:run` against a local-published
  `@ngaf/chat` and verify the migrated demo-shell renders correctly with no
  duplicate chat surfaces.

## Out of scope (future work)

- Bundled "chat playground" composition (was the old `<chat-debug>` shape).
  If a future use case justifies it, it can be reintroduced as a separate
  composition that internally uses `<chat>` + `<chat-debug>` together.
- Detach-to-popup-window (Chrome devtools-style undock).
- Multi-agent comparison view.
- Network / LLM-call / tool-call inspector tabs (the slot API is the
  forward path for these).
