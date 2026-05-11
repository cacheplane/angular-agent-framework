# Nav v2 Polish — Palette Redesign + GenUI Stream Suppression — Design

**Status:** Approved (brainstorm 2026-05-11)
**Scope:** Two adjacent polish items uncovered during live smoke of the nav v2 redesign (PRs #240–#243). Both are demo-shell quality improvements; one extends a lib primitive.
**Replaces:** Nothing structural — both items refine existing functionality merged on `main`.

---

## Problem

Two concrete issues surfaced during live verification of the nav v2 changes:

1. **The control palette feels rough.** Loose alignment, narrow spacing, mixed typography, native `<select>` boxes, raw `○ off` text for the debug toggle. It's functional but doesn't match the polish of the rest of the demo. The user asked it to feel closer to a Next.js dev-tools floating widget — small pill collapsed, compact panel expanded — with shadcn/ui internal conventions.

2. **A2UI tool calls show raw JSON during streaming.** When the LLM calls `generate_a2ui_schema` or `generate_json_render_spec`, the tool's args stream back as ordinary assistant content. The user sees ~3 seconds of scrolling JSON before the rendered `<a2ui-surface>` mounts and replaces it. This is jarring and undermines the "generative UI" experience.

## Solution overview

Two independent fixes, intended to ship as two separate PRs:

- **Palette v2** — single-file rewrite of `examples/chat/angular/src/app/shell/control-palette.{ts,html,css}`. Two states: a compact status pill in the top-right corner (`● gpt-5-mini · embed`) and an expanded shadcn-styled panel with grouped sections (Mode / Model / Appearance / Action). No new primitives. No lib changes.
- **GenUI stream suppression** — extend `chat-message` (`@ngaf/chat`) to detect when an assistant message is invoking a known GenUI tool and suppress the streaming body. Render a new `<chat-genui-skeleton>` primitive in place until the surface mounts via the existing `agent.events$` → surface-store channel.

## Components

### Palette v2 — demo-shell only

**File rewrites**

- `examples/chat/angular/src/app/shell/control-palette.component.ts` — replaced. ~120 LOC. Adds:
  - `collapsed: WritableSignal<boolean>` (already exists, semantics unchanged).
  - `streaming: InputSignal<boolean>` — new input driving the status dot's animation (pulse while streaming, idle-green otherwise).
  - Click-outside detection via a host listener that emits `collapsedChange(true)` when a click lands outside the panel.
  - Keyboard handling: Escape collapses; arrow keys within the segmented mode picker.
- `examples/chat/angular/src/app/shell/control-palette.component.html` — replaced. ~90 LOC. Renders pill or panel depending on `collapsed()`. Panel structure:
  - Header (title `Control palette` + close `×` button).
  - Section: `Mode` — segmented control (Embed / Popup / Sidebar).
  - Section: `Model` — three rows (`Provider`, `Effort`, `Gen UI`), each a label-left / select-trigger-right layout.
  - Section: `Appearance` — `Theme` row + `Debug overlay` switch.
  - Action: full-width `↻ New conversation` button.
- `examples/chat/angular/src/app/shell/control-palette.component.css` — replaced. ~200 LOC. Shadcn-derived dark palette (`#18181b` panel background, `#27272a` borders, `#71717a` muted text, `#fafafa` primary text).

**Shadcn conventions locked in**

- Section headers: 11px, 600 weight, uppercase, 0.04em tracking, muted color.
- Field rows: label left (13px, #d4d4d8); control right with a 140px min-width so all selects line up vertically.
- Select trigger: a styled `<button>` with a caret on the right; native `<select>` is the underlying element, visually overlaid via `opacity: 0` and `position: absolute` (the button shows the current value). This preserves keyboard accessibility and screen-reader behavior without re-implementing dropdown menus.
- Switch: 36×20 pill with a 16px sliding circle. Replaces the `○ off` / `● on` text for the debug toggle.
- Mode segmented: 3-button container with 3px inset padding; active button is solid `#27272a`, inactive is transparent, hover lifts to lighter background.
- Typography: `font-family: ui-sans-serif, system-ui, -apple-system, sans-serif` inside the panel. Monospace only on the status pill outside (collapsed state).
- Spacing: 16px panel side padding, 14px section top/bottom padding, 10px between rows, 1px dividers between sections.

**Status pill (collapsed)**

- 999px border-radius, padded 6×12.
- Contents: animated status dot (`width:8 height:8 background: streaming ? #4f8df5 with pulse : #4ade80`), monospace model name, `·` separator, current mode name.
- `position: fixed; top: 12px; right: 12px; z-index: 1000`.
- Click anywhere on the pill toggles `collapsed()` to false (panel expands).

**Panel (expanded)**

- 320px wide; anchored to `top: 12px; right: 12px` so it grows down-left from the same corner.
- Scale-in animation: `transform: scale(0.96) → 1`, `opacity: 0 → 1`, 120ms ease.
- Close affordances (all three):
  - `×` button in header.
  - Escape keydown anywhere within the panel.
  - Click outside the panel boundary (delegated via `host.document:click`).

**Wired from demo-shell**

- One new input binding: `[streaming]="agent.status() === 'running'"`.
- Existing input/output API unchanged (all 14 model/effort/genUi/theme inputs + outputs + newConversation event).

### GenUI stream suppression — lib primitive

**Changed — `@ngaf/chat`**

- `primitives/chat-message/chat-message.component.ts` — extend with:
  - Module-level constant: `const GENUI_TOOLS = new Set(['generate_a2ui_schema', 'generate_json_render_spec']);`
  - `protected readonly isGenUiToolCall = computed(() => ...)` — true when the message is an assistant with `extra.tool_calls` referencing one of the GenUI tool names, OR a tool message whose `tool_call_id` matches an upstream GenUI tool call.
  - Template branch: when `isGenUiToolCall() && streaming()`, render `<chat-genui-skeleton>` in place of the message body. When `isGenUiToolCall() && !streaming()`, keep the skeleton rendered (the actual surface mounts in a separate slot via the existing `agent.events$` channel; the message's body is permanently suppressed for this message).

**New — `@ngaf/chat`**

- `primitives/chat-genui-skeleton/chat-genui-skeleton.component.ts` — a small standalone component (~40 LOC).
  - Renders a card-shaped placeholder: 1px border `#27272a`, 10px border-radius, padding 14px.
  - Three shimmer rows (varied widths) animated via a `@keyframes` shimmer effect.
  - Top label: `✨ Building UI…` in muted text.
  - No inputs; purely visual.

**Exported** via `libs/chat/src/public-api.ts`.

## Data flow

### Palette v2

```
streaming signal from demo-shell (agent.status === 'running')
  → control-palette [streaming] input
  → status dot CSS class toggles between idle (.dot--idle) and active (.dot--streaming with pulse animation)
  → no other behavior change

user click on pill
  → collapsed.set(false)
  → panel renders, scale-in animation runs

user clicks × / hits Escape / clicks outside
  → collapsed.set(true)
  → pill renders, scale-out animation runs

control change (model/effort/etc)
  → unchanged: emits *Change outputs as before
```

### GenUI suppression

```
LLM emits AIMessage with tool_calls: [{ name: 'generate_a2ui_schema', ... }]
  → message starts streaming through chat-message
  → isGenUiToolCall computed returns true on first stream token
  → template renders <chat-genui-skeleton> instead of the body
  → JSON args stream into the underlying message.content but are never visible

tool runs server-side, returns ToolMessage
  → ToolMessage's tool_call_id matches the upstream AIMessage's tool_call.id
  → isGenUiToolCall returns true for the tool message too
  → skeleton remains; tool message body never renders

graph emits a2ui_surface custom event (via agent.events$)
  → existing surface-store path mounts <a2ui-surface> in its dedicated slot
  → user sees the rendered surface; skeleton continues to display in the message column below (collapsed but present)
```

The skeleton stays even after the surface mounts because the two live in different slots of the chat stream. We could optionally hide the skeleton when the surface mounts (via a signal from the surface store), but the simpler v1 keeps it as a "this turn produced a UI" marker.

## Responsive

- **Palette pill**: stays `position: fixed; top: 12px; right: 12px` across all viewport widths.
- **Palette panel**: 320px desktop. At `(max-width: 480px)` the panel takes `width: calc(100vw - 24px)` with `right: 12px` (full-width minus side gutters).
- **Skeleton**: full message-bubble width; no breakpoint changes.

## Testing

### Unit — `control-palette.component.spec.ts` (extended)

- `collapsed()` defaults to true (pill is the resting state on first run).
- Clicking the pill emits `collapsedChange(false)`.
- Clicking the × button emits `collapsedChange(true)`.
- Escape keydown inside the panel emits `collapsedChange(true)`.
- Mode segmented buttons emit `modeChange` with the right value.
- All other existing tests pass without modification (the input/output API is unchanged).

### Unit — `chat-genui-skeleton.component.spec.ts` (new)

- Renders a `[role="status"]` element with text `Building UI…`.
- Shimmer rows are present in the DOM (`.chat-genui-skeleton__row × 3`).

### Unit — `chat-message.component.spec.ts` (extended)

- A message with `extra.tool_calls = [{ name: 'generate_a2ui_schema' }]` and `streaming: true` renders `<chat-genui-skeleton>` and not `.chat-message__assistant-body`.
- A message with the same `tool_calls` and `streaming: false` still renders the skeleton.
- A message with `extra.tool_calls = [{ name: 'search_documents' }]` renders the normal body (only the two GenUI tool names trigger suppression).
- A tool message with `tool_call_id` matching an upstream GenUI call renders the skeleton.
- A tool message with an unrelated `tool_call_id` renders normally.

### Live smoke

- Click the palette pill at `/embed`, `/popup`, `/sidebar`: panel slides in, all 7 controls work, × button closes.
- Change model / mode / theme: persistence is preserved across reloads (current behavior, must not regress).
- Send a prompt that triggers `generate_a2ui_schema` (e.g. "Render a settings card…"): no JSON visible during streaming; skeleton appears immediately; rendered surface mounts when the tool returns; skeleton remains under the surface as a turn marker.
- Send a prompt that triggers `research` or `search_documents`: streaming bubble renders normally (not suppressed — only the two GenUI tools trigger suppression).

## Risks

- **Native `<select>` overlay**: visually styling the native select via `opacity: 0` over a button trigger is a known pattern but can lead to focus-outline mismatches across browsers. Mitigation: keep the underlying `<select>` keyboard-reachable (Tab focuses it); copy the focus state onto the button via `:focus-within` on the wrapper.
- **Click-outside detection** in Angular needs a HostListener that runs in the browser zone. Could fire from inside-panel clicks if not properly scoped via `event.target.contains()` check. Standard pattern; mitigated by checking the click target against the panel's ElementRef.
- **GenUI tool detection coupling**: `chat-message` doesn't currently know about specific tool names. Hardcoding `generate_a2ui_schema` and `generate_json_render_spec` in a lib primitive creates a knowledge leak. Mitigation: expose `genuiToolNames: InputSignal<readonly string[]>` on `chat-message` (default to the two known names but allow override). Consumers can extend or replace. Same pattern as the `subagentToolNames` input on the LangGraph adapter.
- **Skeleton orphaning**: if the graph never emits `a2ui_surface` (error path), the skeleton stays forever. Mitigation: when the run completes (status transitions out of `running`) AND no surface event fired for this message id, swap the skeleton for an error message ("UI generation failed"). Track via a small lookup map: `Map<messageId, 'pending' | 'rendered' | 'failed'>` on the chat composition. Out of scope for v1; documented as a future polish.

## Phasing

Two independent merge-ready PRs:

1. **Palette v2** (`claude/palette-v2`) — single-file rewrite of `control-palette` + 1 new binding from demo-shell. ~400 LOC including styles. Standalone.
2. **GenUI suppression** (`claude/genui-stream-suppression`) — new `chat-genui-skeleton` primitive + extended `chat-message` + public-api export. ~150 LOC. Standalone — doesn't depend on PR 1.

Either order is fine; they don't share files.

## Out of scope

- Theming the palette panel to follow the A2UI theme selector — by design, the panel stays in shadcn dark (it's a dev tool, like Next.js dev tools).
- Custom dropdown menus (we keep native `<select>` for accessibility).
- Animation polish beyond scale-in/out (no entrance staggering, no spring physics).
- Skeleton-to-error swap when a GenUI run fails (deferred per Risks section).
- Touch-specific palette UI (touch users get the same panel, just on viewports < 480px it goes full-width).
- A "compact" view of the pill when streaming is active (e.g., showing a streaming animation in the dot only — already covered in the design).
