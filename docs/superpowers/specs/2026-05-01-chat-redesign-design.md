# Chat library redesign — production-ready visual overhaul

## Summary

Replace the current `@ngaf/chat` visual surface with a redesigned, Tailwind-free, production-grade chat UI. The redesign:

- Adopts an asymmetric message pattern (user = filled bubble, assistant = inline text with hover-revealed controls).
- Ships three top-level layout modes: embedded (`<chat>`), floating popup (`<chat-popup>`), slide-in sidebar (`<chat-sidebar>`).
- Replaces all Tailwind utility-class usage with hand-written component-encapsulated CSS plus an optional global stylesheet.
- Restyles every adjacent surface — tool calls, subagents, timeline, threads, interrupt panel, debug composition, demo layouts — to a single coherent design system.
- Fixes the v0.0.2 publish-time friction (consumers no longer need Tailwind set up; chat renders correctly out of the box).

This is a coordinated breaking change shipped as `@ngaf/chat@0.0.3`. All first-party consumers (cockpit demos, `libs/example-layouts`, website docs) are updated in the same PR. There is no compatibility shim.

## Goals

1. Production-grade visual quality across every chat surface (messages, input, traces, timeline, threads, debug, layout shells, popup/sidebar chrome).
2. Zero consumer setup to render correctly: `npm install @ngaf/chat`, drop `<chat>` in a template, it works.
3. Single coherent design language across all chat-adjacent components and demos. No mixed bordered cards / bubbles / Tailwind tokens.
4. Three layout modes covering the dominant chat-UI shapes (full-window, floating launcher, slide-in panel).
5. Theme override surface that scales: 90% of consumers tune CSS custom properties; deep restyling available via opt-in global stylesheet.

## Non-Goals

- Voice / push-to-talk wiring (CSS hook only).
- Attachment upload pipeline (UI scaffold only).
- Smart suggestions / agent-driven prompt generation.
- Code-block syntax highlighting (base styling + copy button only).
- Right-to-left language layout.
- Header chrome beyond title + close-X.
- Major-version semantics; release stays on patch (0.0.3) per project policy.

## Design

### Architecture decisions

Three foundational decisions, settled during brainstorming:

| # | Decision | Rationale |
|---|---|---|
| 1 | Three separate compositions (`<chat>`, `<chat-popup>`, `<chat-sidebar>`) over one component with a `mode` input. | Tree-shakable, mirrors existing repo pattern (`<chat-timeline>`, `<chat-debug>`). Each component has a single layout responsibility. |
| 2 | Hybrid styling: component-encapsulated styles + CSS custom properties on `:host` + optional global `chat.css`. | Renders out of the box (Layer 1 + 2), exposes copilotkit-style global-class deep-override surface (Layer 3) without making it a setup step. Improves on copilotkit's React-bundler-side-effect model. |
| 3 | In-place rewrite of `<chat>`, no compatibility shim, ship as 0.0.3. | At 0.0.x stage breaking changes are expected. Cockpit demos updated in the same PR. Patch-only versioning policy applies regardless of break magnitude. |

### Component inventory

#### Top-level compositions

| Selector | Mode | Replaces |
|---|---|---|
| `<chat>` | embedded — fills its container | Existing `<chat>` (rewritten in place) |
| `<chat-popup>` | floating — bottom-right launcher + window (24rem × 600px) | New |
| `<chat-sidebar>` | slide-in — right-edge panel (28rem) | New |
| `<chat-debug>` | unchanged surface; restyled internals | Existing |
| `<chat-timeline-slider>` | vertical history walk; horizontal-slider variant **dropped** | Existing |
| `<chat-interrupt-panel>` | restyled to match trace aesthetic | Existing |

#### Internal layout primitives

| Selector | Purpose | New / changed |
|---|---|---|
| `chat-window` | Header + body + input footer slot. Used by all three top-level modes. | New |
| `chat-launcher-button` | Floating circular button for popup mode. | New |
| `chat-message` | Single message renderer with user-bubble / assistant-inline variants. | New |
| `chat-trace` | Collapsible label + left-border indented content. Used for tool calls, subagents, timeline entries. | New |
| `chat-suggestions` | Render initial prompt chips when empty. | New |

#### Existing primitives — kept, all restyled, all Tailwind-free

| Old name | New name | Notes |
|---|---|---|
| `chat-messages` | `chat-message-list` | Selector + class renamed for clarity. |
| `chat-input` | `chat-input` | Rewritten to pill design (20px radius, 75px min-height, inline send + control slots). |
| `chat-typing-indicator` | `chat-typing-indicator` | Replaced with 3-dot animation. |
| `chat-error` | `chat-error` | Restyled error callout. |
| `chat-interrupt` | `chat-interrupt` | Restyled warning callout. |
| `chat-thread-list` | `chat-thread-list` | Restyled list rows; optional "+ New thread" header button. |
| `chat-tool-calls` | `chat-tool-calls` | Headless data primitive unchanged; default projected template now uses `chat-trace`. |
| `chat-subagents` | `chat-subagents` | Same. |
| `chat-tool-call-card` | `chat-tool-call-card` | Composition rewritten to use `chat-trace` as visual base. Tailwind removed. |
| `chat-subagent-card` | `chat-subagent-card` | Same. |
| `chat-timeline` | `chat-timeline` | Headless data primitive unchanged; default visualization adopts vertical history walk. |
| `chat-generative-ui` | `chat-generative-ui` | Behavior unchanged; wrapper restyled. |

#### Removed

- All Tailwind utility-class usage in chat library output.
- `CHAT_THEME_STYLES`, `CHAT_MARKDOWN_STYLES` public exports (replaced by per-component scoped styles + token file + optional global `chat.css`).
- Avatar block in assistant messages (assistant goes bubble-less, no avatar — matches copilotkit philosophy).
- Horizontal-slider variant of `chat-timeline-slider` (vertical history walk supersedes it).

#### Styles directory restructure

```
libs/chat/src/lib/styles/
├── chat-tokens.ts                  # CSS custom property declarations + keyframes
├── chat-window.styles.ts           # per-component scoped CSS strings
├── chat-message.styles.ts
├── chat-input.styles.ts
├── chat-trace.styles.ts
├── chat-message-list.styles.ts
├── chat-thread-list.styles.ts
├── chat-typing-indicator.styles.ts
├── chat-error.styles.ts
├── chat-interrupt.styles.ts
├── chat-launcher-button.styles.ts
├── chat-suggestions.styles.ts
├── chat-generative-ui.styles.ts
├── chat-markdown.styles.ts         # markdown rendering rules
└── chat.css                        # Layer-3 optional global stylesheet (shipped via package exports map)
```

The `:host`-applied tokens are emitted via a `CHAT_HOST_TOKENS` constant imported into every chat component's `styles` array. The same tokens (with `:root` selector) appear in `chat.css` for consumers who want app-level overrides.

### Visual design system

#### Color tokens

```
Light theme (default):
  --ngaf-chat-bg:                  rgb(255, 255, 255)
  --ngaf-chat-surface:             rgb(255, 255, 255)
  --ngaf-chat-surface-alt:         rgb(251, 251, 251)
  --ngaf-chat-primary:             rgb(28, 28, 28)
  --ngaf-chat-on-primary:          rgb(255, 255, 255)
  --ngaf-chat-text:                rgb(28, 28, 28)
  --ngaf-chat-text-muted:          rgb(115, 115, 115)
  --ngaf-chat-separator:           rgb(229, 229, 229)
  --ngaf-chat-muted:               rgb(200, 200, 200)
  --ngaf-chat-error-bg:            #fef2f2
  --ngaf-chat-error-border:        #fecaca
  --ngaf-chat-error-text:          #dc2626
  --ngaf-chat-warning-bg:          #fffbeb
  --ngaf-chat-warning-text:        #b45309
  --ngaf-chat-success:             #16a34a
  --ngaf-chat-shadow-sm:           0 1px 2px rgba(0,0,0,.05)
  --ngaf-chat-shadow-md:           0 4px 6px -1px rgba(0,0,0,.10), 0 2px 4px -1px rgba(0,0,0,.06)
  --ngaf-chat-shadow-lg:           0 10px 15px -3px rgba(0,0,0,.10), 0 4px 6px -2px rgba(0,0,0,.05)

Dark theme (auto via prefers-color-scheme; opt-out via [data-ngaf-chat-theme="light"]; opt-in via [data-ngaf-chat-theme="dark"]):
  --ngaf-chat-bg:                  rgb(17, 17, 17)
  --ngaf-chat-surface:             rgb(28, 28, 28)
  --ngaf-chat-surface-alt:         rgb(44, 44, 44)
  --ngaf-chat-primary:             rgb(255, 255, 255)
  --ngaf-chat-on-primary:          rgb(28, 28, 28)
  --ngaf-chat-text:                rgb(245, 245, 245)
  --ngaf-chat-text-muted:          rgb(160, 160, 160)
  --ngaf-chat-separator:           rgb(45, 45, 45)
  --ngaf-chat-muted:               rgb(60, 60, 60)
  --ngaf-chat-error-bg:            rgb(45, 21, 21)
  --ngaf-chat-error-text:          #fca5a5
  --ngaf-chat-warning-bg:          rgb(45, 35, 21)
  --ngaf-chat-warning-text:        #fbbf24
  --ngaf-chat-success:             #4ade80
```

#### Geometry tokens

```
--ngaf-chat-radius-bubble:    15px
--ngaf-chat-radius-input:     20px
--ngaf-chat-radius-card:       8px
--ngaf-chat-radius-button:     8px
--ngaf-chat-radius-launcher:  9999px
--ngaf-chat-max-width:         48rem
```

#### Typography tokens

```
--ngaf-chat-font-family:    ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"
--ngaf-chat-font-mono:      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace
--ngaf-chat-font-size:      1rem
--ngaf-chat-font-size-sm:   0.875rem
--ngaf-chat-font-size-xs:   0.75rem
--ngaf-chat-line-height:    1.6
--ngaf-chat-line-height-tight: 1.5
```

#### Spacing scale

```
--ngaf-chat-space-1:  4px
--ngaf-chat-space-2:  8px
--ngaf-chat-space-3:  12px
--ngaf-chat-space-4:  16px
--ngaf-chat-space-5:  20px
--ngaf-chat-space-6:  24px
--ngaf-chat-space-8:  32px
```

#### Animations (defined in `chat-tokens.ts` as keyframes)

- `ngaf-chat-spin` — 1s linear infinite (spinners)
- `ngaf-chat-typing-dot` — 1.4s ease-in-out infinite (3-dot indicator)
- `ngaf-chat-pulse` — 2s cubic-bezier infinite (recording / loading state hooks)

### Message rendering

#### User message
- Right-aligned filled bubble.
- `background: var(--ngaf-chat-primary); color: var(--ngaf-chat-on-primary)`.
- `max-width: 80%; padding: 8px 12px; border-radius: var(--ngaf-chat-radius-bubble)` (15px all corners, no asymmetric tail).
- `white-space: pre-wrap; line-height: var(--ngaf-chat-line-height-tight)`.
- 1.5rem top margin when following an assistant message; 0.5rem otherwise.

#### Assistant message
- No bubble, no avatar, no left-padding offset. Full-width text up to `--ngaf-chat-max-width`.
- `color: var(--ngaf-chat-text); line-height: var(--ngaf-chat-line-height)`.
- `position: relative` wrapper hosts hover-revealed controls.
- 1.5rem top margin between turns.

#### Hover-revealed assistant controls
- Container: `position: absolute; left: 0; bottom: -28px; display: flex; gap: 1rem; opacity: 0; transition: opacity 200ms ease`.
- `opacity: 1` on `.assistant-message:hover`, on `.assistant-message:focus-within`, and unconditionally on viewports `<= 768px`.
- Always-visible on the most recent assistant message.
- Default buttons: copy, regenerate. Slot via `<ng-template chatMessageControls>` for replacement/extension.
- Buttons: 20×20, transparent bg, primary-color stroke, `transform: scale(1.05)` on hover.

#### Streaming behavior
- `chat-streaming-md` unchanged structurally.
- Subtle blinking caret (`▍`, CSS `::after`, 1.2s blink) appended on the **last** assistant message while `agent.isLoading()`.
- Tool-call traces and subagent-activity traces render **above** the markdown body, inside the assistant message wrapper, so the read order is "thinking → answer".

#### Tool / system messages
- Tool messages route through `chat-trace`; never render as standalone rows.
- System messages: centered, italic, `--ngaf-chat-text-muted`, `--ngaf-chat-font-size-xs`, generous vertical padding.

#### Empty state
- Vertically + horizontally centered.
- Optional headline + subline + suggestion chips, all content-projected via `<ng-template chatEmptyState>`.

#### Markdown
- h1 1.5em bold, h2 1.25em 600, h3 1.1em, paragraph line-height 1.75, links underlined.
- Code blocks: `--ngaf-chat-surface-alt` background, `--ngaf-chat-font-mono`, copy button top-right, language label top-left.
- Inline code: subtle bg tint, monospace.

### Input composer

#### Container + pill
- Wrapper `.chat-input-container`: `background: var(--ngaf-chat-bg); padding: 0 0 15px 0`. Hosts banners, attachment queue, the pill, and an optional powered-by footer.
- Pill `.chat-input`: `background: var(--ngaf-chat-surface-alt); border: 1px solid var(--ngaf-chat-separator); border-radius: var(--ngaf-chat-radius-input); padding: 12px 14px; min-height: 75px; width: 95%; margin: 0 auto; cursor: text`.
- `:focus-within` deepens border to `--ngaf-chat-text-muted`.

#### Textarea
- Auto-resizes (1 row min, 6 rows max, scroll after). CSS `field-sizing: content` with JS fallback observing scrollHeight.
- `border: 0; outline: 0; background: transparent; resize: none; width: 100%`.
- `font-size: var(--ngaf-chat-font-size-sm); line-height: 1.5rem; color: var(--ngaf-chat-text)`.
- Placeholder: `var(--ngaf-chat-text-muted)`, `opacity: 1`.
- Custom scrollbar (6px, rounded, transparent track).

#### Controls row (absolute bottom-right inside pill)
- Send (default 24×24, primary stroke, scale-up hover, disabled → muted).
- Optional left-side controls via `[chatInputLeading]` slot.
- Optional right-side controls via `[chatInputTrailing]` slot.
- `.recording` state hooks (red bg + `ngaf-chat-pulse`) wired but inactive — gated by `enableVoice` input default `false`.

#### Submit
- `submitOnEnter` input default `true`. Enter submits; Shift+Enter inserts newline.
- Disabled computed from `agent.isLoading()` and empty content.
- On submit emits `submit` output and calls `agent.submit({ message })` if bound.

#### Attachments queue (slot)
- Renders above the pill when files are queued. Horizontal scroll-row of 64×64 thumbnail tiles. Dismiss-X on hover. Pure UI scaffold; no upload pipeline.

#### Banners
- `<chat-error>`: `--ngaf-chat-error-bg`, `--ngaf-chat-error-border`, `--ngaf-chat-error-text`, card radius, padding 8/12. Icon + message + dismiss-X.
- `<chat-interrupt>`: `--ngaf-chat-warning-bg`, `--ngaf-chat-warning-text`, same shape, action-button slot (Resume / Cancel default templates).
- Both render immediately above the pill, inside the input container.

#### Powered-by footer (optional, off by default)
- Centered 12px text, `--ngaf-chat-muted`. Reserved hook.

### Window primitive + three layout modes

#### `<chat-window>` (internal)
```
chat-window
├─ .chat-window__header   (optional, [chatHeader] slot)
├─ .chat-window__body     (flex: 1; min-height: 0; overflow hidden)
│  ├─ chat-message-list
│  └─ chat-typing-indicator
└─ .chat-window__footer   (interrupt/error banners + chat-input)
```
- Header 56px, hairline bottom border, padding `0 24px`, font-weight 500, optional 35×35 close-X at right.
- Body: scrolls internally with the auto-scroll-to-bottom logic from current `<chat>`.
- Custom 6px scrollbar.

#### `<chat>` (embedded)
- `:host { display: flex; flex-direction: column; height: 100%; }`. Consumer controls sizing.
- No chrome around `<chat-window>`.
- Header opt-in via `[chatHeader]` slot (default no header).

```html
<chat [agent]="agent" />
```

#### `<chat-popup>`
- Fixed bottom-right of viewport. Two visible elements:
  1. `<chat-launcher-button>` — circular 56×56 at `bottom: 1rem; right: 1rem`, primary background, chat icon. Toggles open state.
  2. Window — 24rem × 600px on `≥640px`, full-screen below. `position: fixed; bottom: 5rem; right: 1rem; border-radius: 0.75rem; box-shadow: 0 5px 40px rgba(0,0,0,.16)`.
- Open animation 200ms ease-out: `transform: scale(.95) translateY(20px); opacity: 0` → `transform: scale(1) translateY(0); opacity: 1`. Closing reverses, then `pointer-events: none`.
- Header default: title + close-X (`[chatHeader]` slot for title content).

```html
<chat-popup [agent]="agent" [(open)]="isOpen">
  <ng-template chatHeader>My Assistant</ng-template>
</chat-popup>
```

#### `<chat-sidebar>`
- Fixed right edge. Window 28rem wide on `≥640px`, full-width below.
- `position: fixed; top: 0; right: 0; bottom: 0; border-radius: 0`. Full-height shadow on left side.
- Open animation 200ms ease-out: `transform: translateX(100%)` → `transform: translateX(0)`. No opacity fade.
- `pushContent` input (default `false`). When `true`, the sidebar wraps the user's app content via `<ng-content>` and shifts it leftward via `margin-right` transition when opened.

```html
<chat-sidebar [agent]="agent" [(open)]="isOpen" [pushContent]="true">
  <ng-template chatHeader>Assistant</ng-template>
  <main>...app content...</main>
</chat-sidebar>
```

#### Shared API (popup + sidebar)
- `[(open)]` two-way binding (`WritableSignal<boolean>` consumer side).
- Imperative `toggle()`, `openWindow()`, `closeWindow()` methods.
- Default closed.

#### Mobile
- `<640px`: popup goes full-screen; sidebar goes full-width slide-in.
- `<=768px`: hover-revealed message controls become always-visible (matches copilotkit's `@media` rule).

### Trace primitive — drives tool calls, subagents, timeline

#### `<chat-trace>`
Single primitive serving three uses.

```
chat-trace
├─ .chat-trace__header   (button, click toggles)
│  ├─ chevron icon (rotates 90° expanded, 200ms ease)
│  ├─ status icon (pending/running/done/error — content-projected)
│  ├─ <ng-content select="[traceLabel]" />
│  └─ optional metadata badge (right-aligned)
└─ .chat-trace__content
   └─ <ng-content />
```

- Header: `display: flex; align-items: center; gap: 0.25rem; cursor: pointer; user-select: none; font-size: var(--ngaf-chat-font-size-sm); color: var(--ngaf-chat-text-muted)`.
- Content: `padding-left: 1rem; padding-top: 0.375rem; margin-left: 0.375rem; border-left: 1px solid var(--ngaf-chat-separator); max-height: 250px; overflow: auto`.
- States: `running` adds `ngaf-chat-pulse` to label; `done` shows muted check; `error` switches to error-color text + icon. No outer border, no background fill.

Inputs:
- `expanded: WritableSignal<boolean>` — defaults `false`; auto-opens to `true` on `state="running"`; auto-collapses 200ms after transitioning to `done`.
- `state: 'pending' | 'running' | 'done' | 'error'`.

#### Tool calls
`<chat-tool-call-card>` renders `<chat-trace>`:
- Label: tool icon + monospace `{toolName}` + status word.
- Expanded: stacked `Inputs` / `Output` sections, each with 11px UPPERCASE label, `<pre>` body using `--ngaf-chat-font-mono` and `--ngaf-chat-font-size-xs`, `whitespace: pre-wrap`. No background fill.

`<chat-tool-calls>` headless primitive renders one card per tool call by default.

In assistant turns containing `tool_use` blocks, traces stack **above** the markdown body, inside the assistant message wrapper.

#### Subagents
`<chat-subagent-card>` renders `<chat-trace>`:
- Label: agent icon + "Subagent" + monospace tool-call id chip + status pill.
- Pill colors: pending=neutral, running=warning + pulse, complete=success, error=error.
- Expanded: message count line + "Latest message" block matching tool-call layout.

`<chat-subagents>` headless primitive default-renders these cards.

Active (non-complete, non-error) subagents render stacked above the assistant turn currently producing them.

#### Timeline
`<chat-timeline-slider>` becomes a vertical history walk:
- Each checkpoint = a `<chat-trace>`-shaped entry: chevron + timestamp + short summary, indented continuation showing state diff when expanded.
- A single shared left-border runs through all checkpoints (container `border-left`).
- Active checkpoint: primary-color chevron + bold label.
- Hover/click emits `checkpointSelected`.
- Optional 32px footer below the list with text-button controls (jump-to-latest, replay).
- Horizontal-slider variant **dropped**.

#### Thread list
`<chat-thread-list>` data API kept; default projected template restyled:
- 36px row, `padding: 8px 12px; border-radius: var(--ngaf-chat-radius-button); cursor: pointer`.
- Active: `background: var(--ngaf-chat-surface-alt); font-weight: 500`.
- Hover: `background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent)`.
- Single-line ellipsis. No outer borders, no chevrons.
- Optional "+ New thread" button at top: full-width, dashed border, primary-color text, hover-fills.

In `<chat-sidebar>`, optional collapsed thread-list slot (above the message body), labeled "Threads ▾".

#### Interrupt panel
`<chat-interrupt-panel>` becomes a content card matching trace aesthetic:
- `--ngaf-chat-warning-bg`, `border-left: 3px solid var(--ngaf-chat-warning-text)`, `padding: 12px 16px; border-radius: var(--ngaf-chat-radius-card)`.
- Title row: warning icon + "Agent paused" + dismiss-X.
- Body: interrupt prompt.
- Action row: content-projected buttons (Resume / Cancel defaults).

#### Debug composition
`<chat-debug>` keeps its public surface. Inner cards (`debug-checkpoint-card`, `debug-controls`, `debug-detail`, `debug-state-diff`, `debug-state-inspector`, `debug-summary`, `debug-timeline`) all rewritten to use trace pattern + new tokens. Tailwind utility classes removed throughout.

### Migration & downstream updates

#### Version
`@ngaf/chat@0.0.3` (patch only, per project policy). Other libs only bump if their source changed.

#### Public API breaking changes (changelog)
- `<chat>` template/visual API changed: no avatar slot; asymmetric message layout; slot names `chatEmptyState` / `chatMessageControls`.
- `<chat-messages>` selector + `ChatMessagesComponent` class renamed to `<chat-message-list>` / `ChatMessageListComponent`. Old name removed.
- `<chat-typing-indicator>` template restyled (visual change only, no API change).
- `chat-timeline-slider` — horizontal-slider input/output API removed; vertical only.
- `CHAT_THEME_STYLES` and `CHAT_MARKDOWN_STYLES` removed from public API. Migration: override `--ngaf-chat-*` custom properties or `import '@ngaf/chat/chat.css'`.
- All Tailwind utility classes removed from chat output. Consumers without Tailwind setup (which were already broken on 0.0.2) now render correctly.

#### Cockpit demos updated (19)
- `cockpit/chat/{messages,input,threads,tool-calls,subagents,timeline,interrupts,theming,debug,generative-ui,a2ui}/angular`
- `cockpit/langgraph/{streaming,persistence,memory,interrupts,durable-execution,time-travel,subgraphs,deployment-runtime}/angular`

For each: replace Tailwind classes in local templates, swap `<chat-messages>` → `<chat-message-list>`, drop dependence on `CHAT_THEME_STYLES` / `CHAT_MARKDOWN_STYLES`, regenerate any demo screenshots referenced by the website.

#### libs/example-layouts
- `example-chat-layout.component` and `example-split-layout.component` rewritten: Tailwind classes (`flex flex-col md:flex-row`, `border-gray-800`, `w-72`) replaced with hand-written CSS in `styles`, using `--ngaf-chat-*` tokens for colors/borders.

#### Smoke app + PR #157 docs revert
- The Tailwind-required documentation added in PR #157 is **superseded** by this redesign. As part of this work:
  - Revert `apps/website/content/docs/chat/getting-started/installation.mdx` Tailwind section.
  - Revert quickstart.mdx Tailwind step.
  - New installation.mdx flow: `npm install @ngaf/chat`. Done.
  - Optional consumer step: `import '@ngaf/chat/chat.css'` in global styles.

#### Website docs
- `getting-started/installation.mdx` — remove Tailwind section; add Theming section (CSS custom properties + optional global stylesheet).
- `getting-started/quickstart.mdx` — remove Tailwind step.
- `guides/theming.mdx` — rewrite to document `--ngaf-chat-*` tokens, light/dark modes, attribute override, optional layer-3 stylesheet.
- Component reference pages — regenerated to match new APIs.
- New pages: `components/chat-popup.mdx`, `components/chat-sidebar.mdx`, `components/chat-trace.mdx`, `guides/layout-modes.mdx`.

#### Tests
- All `*.component.spec.ts` for restructured/renamed components updated. Visual specs (computed style assertions) refreshed against new tokens.
- New specs: `<chat-popup>`, `<chat-sidebar>`, `<chat-window>`, `<chat-trace>`, asymmetric message templates.
- Conformance tests against the public chat API kept passing.
- `cockpit/chat/footprint.spec.ts` and `cockpit/chat/matrix.spec.ts` updated.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Breaking-change blast radius across 19 demos + docs + tests is large; high merge-conflict risk if work is split. | Land as a single coordinated PR. Sequence within the PR: tokens → primitives → compositions → demos → docs. |
| Removing Tailwind from chat library means cockpit demos that *also* use Tailwind elsewhere keep working, but `libs/example-layouts` cannot rely on Tailwind anymore. | `example-layouts` is the only remaining Tailwind-heavy first-party consumer; rewriting both layouts in the same PR contains the change. |
| CSS custom property `--ngaf-chat-*` rename breaks any consumer overriding `--chat-*` from 0.0.2. | Document in changelog. Consumers running on 0.0.2 had a broken render anyway; this is a real but low-cost rename. |
| Asymmetric message layout removes the assistant avatar consumers may expect. | Documented behavior change. Avatar can be re-added by a consumer via the `chatMessageControls` / `chatEmptyState` slots if needed. |
| The new `chat-trace` indented-content pattern may not handle very long tool outputs gracefully. | Content has `max-height: 250px` and internal scroll, matching copilotkit. |
| `field-sizing: content` for textarea autosize lacks support in older browsers. | JS fallback observing scrollHeight is part of the input rewrite. |

## Out of scope (explicit)

- Voice / push-to-talk (CSS hooks only, no integration).
- Attachments upload pipeline (UI scaffold only).
- Smart suggestion auto-generation.
- Code-block syntax highlighting beyond base styling + copy button.
- RTL layout support.
- Header chrome beyond title + close-X.
- Modifying the minting service (proprietary, excluded).

## Approval gate

Once this spec is approved, hand off to the `superpowers:writing-plans` skill to produce the implementation plan. The plan will sequence the work as: design tokens → primitive rewrites → composition rewrites → cockpit demo updates → docs → tests → release notes.
