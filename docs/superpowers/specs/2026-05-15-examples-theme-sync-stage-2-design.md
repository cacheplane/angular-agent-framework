# Cockpit Examples Theme Sync — Stage 2 Design

**Date:** 2026-05-15
**Status:** Spec — pending implementation plan
**Predecessor:** `docs/superpowers/specs/2026-05-13-cockpit-examples-theme-sync-design.md` (Stage 1 — library + chat-timeline pilot)

## Goal

Complete the rollout of cockpit-example theme sync to the remaining 31 Angular example apps under `cockpit/<library>/<capability>/angular/`. Embedded chat surfaces in cockpit follow the host theme (light + dark) seamlessly across every capability, not just the pilot. Reference code stays clean for external developers.

Out of scope:
- Backend examples (the `python/` agent servers under each capability) — no UI, no theming
- Stage 1 work — already shipped (#301, #302)
- Light or dark palette changes — already shipped (#321 light, #333 dark)
- Chat lib palette unification — independent (decision C from PR 2)

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Auto-install mechanism | Module-level side effect in `@ngaf/example-layouts/src/public-api.ts` — runs once on first import of any export from the library |
| 2 | Template var convention | `--ngaf-chat-*` (chat lib namespace) for all surface/text/border references in example component templates; no `--ds-*` in template source |
| 3 | A2UI consistency | Wrap a2ui's `<chat>` in `<example-chat-layout>` for structural consistency with the other 30 chat-family apps |
| 4 | PR cadence | 5-PR sequence: PR-0 (library + pilot cleanup), PR-1 (chat wave), PR-2 (langgraph), PR-3 (deep-agents), PR-4 (render + ag-ui) |
| 5 | Smoke verification | Full manual chrome MCP smoke per wave — every app's capability route in cockpit, light + dark, eyeball each before merging that wave |

## Architecture

**Reference code surface (per example app, after migration):**

`src/main.ts`:
```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';

bootstrapApplication(TimelineComponent, appConfig).catch((err) => console.error(err));
```

No cockpit-specific imports. No `installEmbeddedTheme()` call. External developers can copy this verbatim into their own app and it just works (no theme sync needed when not iframed).

`src/styles.css`:
```css
@import "@ngaf/example-layouts/theme.css";

html, body {
  height: 100%;
  margin: 0;
  background: var(--ngaf-chat-bg);
  color: var(--ngaf-chat-text);
  font-family: var(--ngaf-chat-font-family);
}
```

References `--ngaf-chat-*` (auto-injected when any `@ngaf/chat` component imports).

`src/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>...</title>
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <app-foo></app-foo>
</body>
</html>
```

No Tailwind v3 CDN script. No hardcoded body classes. Tailwind v4 comes from the styles.css import.

**How theme sync works under the hood:**

1. App boots; imports `ExampleChatLayoutComponent` (or `ExampleSplitLayoutComponent`) from `@ngaf/example-layouts` — this is sufficient to trigger the module-level side effect
2. `@ngaf/example-layouts/src/public-api.ts` side effect: calls `installEmbeddedTheme('dark')` if `typeof document !== 'undefined'`
3. `installEmbeddedTheme()`:
   - Sets `data-theme="dark"` on `<html>`
   - Applies `cssVars('dark')` to `document.documentElement.style`
   - Posts `{ type: 'ngaf:theme-request' }` to `window.parent` (no-op if not iframed)
   - Listens for `{ type: 'ngaf:theme', theme }` messages
4. When iframed by cockpit's `<ThemedFrame>`: cockpit's broadcast or handshake reply updates the iframe's theme; chat lib's auto-injected `--ngaf-chat-*` tokens follow via the bridge in `@ngaf/example-layouts/theme.css`
5. When NOT iframed (standalone, `examples.cacheplane.ai`): the default `'dark'` theme stays applied. Chat lib's auto-injection populates `--ngaf-chat-*` independently.

**External developer experience:**
- Sees clean Angular reference code (no postMessage, no cockpit-specific calls in the template/main)
- The library imports they'd already do (`@ngaf/chat`, `@ngaf/example-layouts`, `@ngaf/langgraph`) handle theme setup transparently
- Optional: external dev wires up their own theme system via `data-theme="light"` or `"dark"` on root — chat lib's three-layer cascade respects that

## Pilot cleanup

`cockpit/chat/timeline/angular/` (the Stage 1 pilot) currently has the explicit `installEmbeddedTheme()` call. Migrate it to the same clean form as Stage 2 apps:

- **`src/main.ts`** — remove the `import { installEmbeddedTheme } from '@ngaf/example-layouts';` line and the `installEmbeddedTheme();` call
- **`src/app/timeline.component.ts`** — replace `style="background: var(--ds-canvas); color: var(--ds-text-primary);"` with `style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);"` and `style="color: var(--ds-text-muted);"` with `style="color: var(--ngaf-chat-text-muted);"`

After this cleanup, the pilot is structurally identical to every other Stage 2 app — same `main.ts` shape, same template var convention.

This cleanup happens in **PR-0** (library + pilot cleanup).

## A2UI migration shape

Current `cockpit/chat/a2ui/angular/src/app/a2ui.component.ts`:
```ts
template: `<chat [agent]="agent" [views]="catalog" class="block h-screen" />`,
```

After migration:
```ts
imports: [ChatComponent, ExampleChatLayoutComponent],
template: `
  <example-chat-layout>
    <chat main [agent]="agent" [views]="catalog" class="flex-1 min-w-0" />
  </example-chat-layout>
`,
```

The chat goes in the `main` slot of `<example-chat-layout>`. No sidebar content is projected — a2ui doesn't need one. The layout's default behavior with an empty sidebar slot handles this gracefully (other chat examples like `chat-messages` similarly have no sidebar content).

This migration happens in **PR-1** (chat wave) alongside the other chat apps.

## Per-app migration pattern (every Stage 2 app)

The pattern follows the Stage 1 pilot (with the Q2=B adjustment to use `--ngaf-chat-*`):

1. **`src/index.html`** — drop the `<script src="https://cdn.tailwindcss.com">` line. Remove `class="bg-gray-950 text-gray-100 h-screen"` from `<body>`. (Other attributes preserved.)

2. **`src/styles.css`** — replace contents with:
   ```css
   @import "@ngaf/example-layouts/theme.css";

   html, body {
     height: 100%;
     margin: 0;
     background: var(--ngaf-chat-bg);
     color: var(--ngaf-chat-text);
     font-family: var(--ngaf-chat-font-family);
   }
   ```

3. **`src/main.ts`** — no changes. The act of importing `ExampleChatLayoutComponent` (or `ExampleSplitLayoutComponent`) in the app's component triggers the side effect.

4. **Component templates** — find/replace per the var sweep table:

   | From | To |
   |---|---|
   | `style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);"` | `style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);"` |
   | `style="color: var(--chat-text-muted, #777);"` | `style="color: var(--ngaf-chat-text-muted);"` |
   | `bg-gray-950` | `bg-[var(--ngaf-chat-bg)]` |
   | `bg-gray-900` | `bg-[var(--ngaf-chat-surface)]` |
   | `text-gray-100`, `text-gray-200` | `text-[var(--ngaf-chat-text)]` |
   | `text-gray-300`, `text-gray-400`, `text-gray-500` | `text-[var(--ngaf-chat-text-muted)]` |
   | `border-gray-800`, `border-gray-700` | `border-[var(--ngaf-chat-separator)]` |

5. **Build verification** — `pnpm nx build <project-id>` clean.

## Wave grouping

| Wave | PR | Apps | Library group |
|---|---|---|---|
| 0 | PR-0 | n/a — library + pilot cleanup | `@ngaf/example-layouts` auto-install + chat-timeline pilot adjustment |
| 1 | PR-1 | 10 apps | chat (messages, input, interrupts, tool-calls, subagents, threads, generative-ui, debug, theming, a2ui*) |
| 2 | PR-2 | 8 apps | langgraph (persistence, durable-execution, streaming, interrupts, memory, subgraphs, time-travel, deployment-runtime) |
| 3 | PR-3 | 6 apps | deep-agents (planning, filesystem, subagents, memory, skills, sandboxes) |
| 4 | PR-4 | 7 apps | render (spec-rendering, element-rendering, state-management, registry, repeat-loops, computed-functions) + ag-ui (streaming) |

*A2UI in wave 1 includes the `<example-chat-layout>` wrapper migration documented above.

## Smoke verification (per wave)

After implementing each wave's apps and confirming local builds pass:

1. Start cockpit dev server: `pnpm nx serve cockpit --port 3000`
2. Start each app in the wave on its assigned port (per `apps/cockpit/scripts/capability-registry.ts`)
3. In chrome MCP, for each app in the wave:
   a. Navigate to the capability route in cockpit (e.g., `/chat/core-capabilities/messages/overview/python`)
   b. Wait for iframe load
   c. Confirm dark mode (default): cockpit chrome + iframe both dark with chat-lib's neutral palette
   d. Toggle to light: both flip
   e. Screenshot dark + light to `docs/superpowers/screenshots/2026-05-15-stage-2-wave-N/<capability>/`
   f. Eyeball: no white-bleed-through in dark, no dark-bleed-through in light, layout intact, chat input theme matches host
4. If any app regresses, fix before merging that wave
5. Push wave PR, CI green, squash-merge, next wave

## Risks and mitigations

- **Module-level side effect timing.** If `installEmbeddedTheme()` runs before Angular's bootstrap and there's any race condition with the `<chat>` component's `ensureChatRootStyles()`, theme vars might temporarily flicker. Mitigated by Angular's deterministic module load order (side effect runs synchronously on module evaluation; chat root tokens also auto-inject synchronously; both before any rendering).
- **A2UI layout regression.** Wrapping `<chat>` in `<example-chat-layout>` changes the DOM shape. The chat needs `class="flex-1 min-w-0"` in the `main` slot per other examples' convention; without it, the chat may not size correctly. Mitigated by visual smoke per wave.
- **Per-app template surprises.** Some apps have unique inline styling I haven't surveyed. Mitigated by per-app build verification + visual smoke catching anything the find/replace table doesn't cover.
- **Cocktail of running dev servers.** Manual smoke for ~10 apps requires running cockpit + 10 dev servers locally. Memory + port usage non-trivial. Mitigated by running serially (start app's server, smoke, kill, next).
- **Build hot-reload picking up the auto-install side effect.** Each app needs to import `@ngaf/example-layouts` somewhere (already true for 30/31 apps; a2ui added in this PR). If an app imports it but doesn't use any export, tree-shaking might drop the side effect. Mitigated by exposing the side effect via a named export that's actually consumed (the layout component import).

## Out-of-scope follow-ups (track but defer)

- Removing the `@ngaf/example-layouts/theme.css` namespace bridge — now redundant in both light and dark (chat lib's palette and design-tokens palette converged)
- Doc h1/h2/h3 size tokenization
- `--ds-*` prefix rename
- Tailwind v4 PostCSS config consolidation (each app may have its own minor config)
