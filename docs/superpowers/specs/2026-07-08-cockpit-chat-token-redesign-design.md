# Cockpit Chat Token Redesign

## Goal

Redesign the bespoke UI in the affected `deep-agents`, `chat`, and `ag-ui`
cockpit Angular examples so it does not depend on Tailwind utilities that are
not compiled in embedded example builds.

The examples should use Angular component-scoped `styles:` blocks and a public
chat styling control surface named `--tplane-chat-*`. The shared example theme
bridge maps those public chat tokens to the underlying `--ds-*` design tokens.

## Context

The embedded cockpit example builds import Tailwind through
`@threadplane/example-layouts/theme.css`. Tailwind v4 source detection does not
scan each consuming example app's `src/**` templates from that import path, so
app-level Tailwind utilities such as `p-4`, `rounded-lg`, and `font-semibold`
produce no usable styling rules for bespoke example markup.

Most examples still look styled when they render only library components such
as `<chat>`, `<chat-thread-list>`, or `<chat-interrupt-panel>`, because those
library components ship encapsulated styles. The broken surface is bespoke UI
owned by the example app: sidebars, status rows, small cards, projected approval
body content, and inline render/tool view components.

The existing theme bridge in `libs/example-layouts/src/theme.css` already maps a
small set of `--tplane-chat-*` variables to `--ds-*`, but it is incomplete. Some
examples reference undefined variables such as `--tplane-chat-primary`,
`--tplane-chat-on-primary`, and semantic status variables.

## Design Direction

Use `--tplane-chat-*` as the public chat/example styling API and `--ds-*` as the
implementation layer. Bespoke cockpit examples should consume the chat-facing
tokens, not raw `--ds-*`, unless there is no meaningful chat token for a value.

This keeps chat theming focused: users can customize chat UI through a chat
namespace without overriding global design-system tokens that may also affect
docs, cockpit chrome, render demos, or marketing pages.

## Token Bridge

Extend the bridge in `libs/example-layouts/src/theme.css` using the existing
chat library vocabulary from `libs/chat/src/lib/styles/chat-tokens.ts`. Do not
introduce a parallel naming scheme that would require migrating library
internals.

The bridge should define at least these public chat variables for cockpit
examples:

| Public token | Default source |
| --- | --- |
| `--tplane-chat-bg` | `--ds-canvas` |
| `--tplane-chat-surface` | `--ds-surface` |
| `--tplane-chat-surface-alt` | `--ds-surface-tinted` |
| `--tplane-chat-input-bg` | `--ds-surface` |
| `--tplane-chat-text` | `--ds-text-primary` |
| `--tplane-chat-text-muted` | `--ds-text-muted` |
| `--tplane-chat-muted` | `--ds-text-muted` |
| `--tplane-chat-separator` | `--ds-border` |
| `--tplane-chat-primary` | `--ds-chat-purple` for chat examples |
| `--tplane-chat-accent` | Alias to `--tplane-chat-primary` for existing examples |
| `--tplane-chat-on-primary` | `--ds-text-inverted` or a contrast-safe fixed value |
| `--tplane-chat-font-family` | `--ds-font-sans` |
| `--tplane-chat-font-mono` | `--ds-font-mono` |
| `--tplane-chat-font-size` | Existing chat default, unless a `--ds-*` size token exists |
| `--tplane-chat-font-size-sm` | Existing chat default |
| `--tplane-chat-font-size-xs` | Existing chat default |
| `--tplane-chat-radius-card` | `--ds-radius-md` |
| `--tplane-chat-radius-button` | `--ds-radius-sm` |
| `--tplane-chat-radius-bubble` | Existing chat default or `--ds-radius-lg` |
| `--tplane-chat-radius-input` | Existing chat default or `--ds-radius-lg` |
| `--tplane-chat-radius-launcher` | `--ds-radius-full` |
| `--tplane-chat-shadow-sm` | `--ds-shadow-sm` |
| `--tplane-chat-shadow-md` | `--ds-shadow-md` |
| `--tplane-chat-shadow-lg` | `--ds-shadow-lg` |
| `--tplane-chat-success` | Fixed semantic green |
| `--tplane-chat-warning-bg` | Fixed or `color-mix()` semantic warning surface |
| `--tplane-chat-warning-text` | Fixed semantic warning text |
| `--tplane-chat-error-bg` | Fixed or `color-mix()` semantic error surface |
| `--tplane-chat-error-border` | Fixed semantic error border |
| `--tplane-chat-error-text` | Fixed semantic error text |
| `--tplane-chat-destructive` | Fixed destructive action color |

Semantic status defaults can be fixed colors or `color-mix()` expressions in
the bridge because there are no `--ds-success`, `--ds-warning`, or `--ds-error`
tokens today. If an example needs a one-off state that does not map to this
public surface, define a local component variable that references the closest
chat token rather than adding a new public token casually.

## Example Styling Pattern

Each affected bespoke component should replace Tailwind utility classes and
inline style attributes with ordinary scoped class names:

- Sidebar shell classes such as `.panel`, `.cap`, `.empty`, `.row`, `.badge`,
  `.btn`, `.code`, and `.kv`.
- View/tool card classes such as `.wc`, `.cb`, `.file-card`, `.exec-card`,
  `.checklist`, and `.result-pill`.
- Real CSS selectors for interaction states such as `:hover`, `:focus-visible`,
  `[data-status="complete"]`, and modifier classes.

Example markup may keep `class="flex-1 min-w-0"` on `<chat>` or other library
host elements as a harmless no-op exception, but bespoke elements should not
carry Tailwind utility classes.

## Scope

The implementation should audit and restyle only the bespoke UI in these
capability areas:

- `cockpit/deep-agents`: `skills`, `sandboxes`, `filesystem`, `planning`,
  `subagents`, and `memory`.
- `cockpit/chat`: `input`, `messages`, `theming`, `threads`, `interrupts`,
  `timeline`, `tool-calls`, `subagents`, and `generative-ui` render-view
  cards.
- `cockpit/ag-ui`: `interrupts`, `tool-views`, `client-tools`, and
  `json-render` view cards.

Pure library-composed examples such as simple `<chat>` wrappers should be left
alone except for no-op `sidebarWidth="w-*"` fixes when present.

## Behavior Preservation

The redesign is styling-only. Preserve:

- Agent injection, providers, store wiring, thread callbacks, and submit/resume
  handlers.
- Schema-anchored inputs such as `ViewProps<typeof schema>` in client tool
  cards.
- Welcome suggestion labels, prompt text, and other strings asserted by e2e
  fixtures.
- Tool/view registry keys and component selectors.
- Existing rendered library components and their internal chrome.

## Theming Example

`cockpit/chat/theming` should continue to demonstrate chat theming, but it
should demonstrate the public `--tplane-chat-*` API rather than deprecated or
undefined variables. Its theme presets should set chat-facing variables. Its
visible token list and any manual/e2e expectations should be updated to match
the supported public control surface.

## Verification

For each affected project:

- Grep the changed bespoke component files for Tailwind utility classes,
  visual inline styles, `--ds-*` direct usage, and undefined old chat
  variables. Data-bound custom properties used for layout, such as
  `[style.--container-cols]`, are allowed when they are structural rather than
  theme styling.
- Build with `npx nx build <project> --configuration=production`.
- After each capability, run a grouped `npx nx run-many -t build
  --configuration=production -p <changed-projects>`.
- Confirm built output includes the new scoped classes and `--tplane-chat-*`
  references for changed bespoke components.

If new colocated `*.spec.ts` files are added under an example app's `src/`,
add the defensive `tsconfig.app.json` excludes for `src/**/*.spec.ts` and
`src/**/*.test.ts`.

## Non-Goals

- Do not fix Tailwind source detection or move the Tailwind import.
- Do not redesign `@threadplane/chat` library internals as part of this pass.
- Do not change backend agents, fixtures, e2e flow semantics, or runtime data
  contracts.
- Do not replace the design-token system; the bridge remains backed by
  `--ds-*`.
