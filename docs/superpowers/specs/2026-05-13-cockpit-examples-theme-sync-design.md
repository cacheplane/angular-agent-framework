# Cockpit Examples Theme Sync + Tailwind v4 Migration — Design

**Date:** 2026-05-13
**Scope:** 32 Angular example apps under `cockpit/<library>/<capability>/angular/`
**Status:** Spec — pending implementation plan

## Goal

Bring every cockpit example app up to current standards in two stages:

1. **Theme sync** — each app listens for `ngaf:theme` postMessage from its cockpit host and flips its own `<html data-theme>` + CSS variables, so the embedded surface matches whatever theme cockpit is showing.
2. **Tailwind v4 migration** — replace the Tailwind v3 Play CDN in every app with a v4 setup centralized in `@ngaf/example-layouts`, paired with a runtime palette injection driven by `@ngaf/design-tokens` (TS-as-source-of-truth, consistent with cockpit).

Each app needs to look correct in both light and dark mode after this work. The shell color values match what cockpit applies; templates use CSS-variable utilities (`bg-[var(--ds-canvas)]` etc.) so the swap is a variable update, not a class swap.

Out of scope:
- Python agent servers under `cockpit/<library>/<capability>/python/` — no UI, no theming work
- The cacheplane example deployment pipeline itself (still publishes to `examples.cacheplane.ai`)
- New design-token values — palette stays exactly what the cockpit dark-mode PR shipped
- Replacing the chat library's internal `--chat-*` variables; only example app templates migrate from `var(--chat-bg)` → `var(--ds-canvas)` etc.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Where theme machinery lives | Centralized in `@ngaf/example-layouts`; a2ui imports the helper directly (97% via layout component, 1 outlier via direct import) |
| 2 | Tailwind version | v4, via `@ngaf/example-layouts/theme.css` consumed by every app |
| 3 | Palette source | TS-as-source-of-truth via `cssVars(theme)` from `@ngaf/design-tokens` (relocated from `@ngaf/ui-react`); applied at runtime by `installEmbeddedTheme()` |
| 4 | Template styling | CSS-variable utilities everywhere (`bg-[var(--ds-canvas)]`, `text-[var(--ds-text-primary)]`); no `dark:` variants in templates |
| 5 | Staging | C — library + 1 pilot app first, then remaining 31 in waves |

## Architecture

**Palette flow:**

1. Tokens defined in TS: `baseTokens`, `lightOverrides`, `darkOverrides` in `@ngaf/design-tokens` (already shipped by cockpit PR)
2. `cssVars(theme: Theme)` resolves the right token set into a `--ds-*` map — moves from `@ngaf/ui-react` to `@ngaf/design-tokens`; `@ngaf/ui-react` re-exports for the React side so cockpit's existing import path keeps working
3. Each example app calls `installEmbeddedTheme()` on boot — applies `cssVars('dark')` to `document.documentElement.style`, sets `data-theme="dark"`, listens for `ngaf:theme` messages, posts `ngaf:theme-request` to parent
4. When cockpit's `<ThemedFrame>` posts a theme update, the embedded app reapplies `cssVars(next)` and updates `data-theme` — visual flip is immediate

**Tailwind v4 flow:**

1. `@ngaf/example-layouts/theme.css` is the Tailwind entry:
   ```css
   @import "tailwindcss";
   @custom-variant dark (&:where([data-theme="dark"] *));
   ```
   No `@theme` block, no palette values — the palette is injected at runtime via `cssVars(theme)`.
2. Each app's `styles.css` becomes:
   ```css
   @import "@ngaf/example-layouts/theme.css";
   ```
3. Each app's Angular build (`@angular/build:application`) picks up the imported CSS and runs Tailwind v4 over the templates in the app's `src/`. The `@source` directive (or v4's default behavior) handles scanning consuming app files.
4. Templates use arbitrary-value utilities: `class="bg-[var(--ds-canvas)] text-[var(--ds-text-primary)] border-[var(--ds-border)]"` etc. Tailwind generates these statically at build time.

**Why this is consistent with cockpit's architecture:**

| Concern | Cockpit | Examples |
|---|---|---|
| Source of theme truth | TS tokens in `@ngaf/design-tokens` | Same |
| Runtime resolution | `cssVars(theme)` → inline `style` on `<html>` | Same |
| Source of truth swap mechanism | Cookie + RSC refresh | postMessage from parent |
| Variable application | Inline style on `<html>` in root layout | Inline style on `<html>` via `installEmbeddedTheme()` |
| `data-theme` attribute | Set in root layout | Set by `installEmbeddedTheme()` |

The architectures mirror each other; the only difference is where the source-of-truth signal comes from (cookie vs postMessage).

## Package changes

**`@ngaf/design-tokens`:** 0.0.32 → 0.0.33
- `src/index.ts`: add `export { cssVars, type CssVars } from './lib/css-vars';`
- `src/lib/css-vars.ts`: new file, moved from `@ngaf/ui-react`. Content identical to current implementation in ui-react.

**`@ngaf/ui-react`:** 0.0.30 → 0.0.31
- `src/lib/css-vars.ts`: deleted
- `src/index.ts`: replace `export { cssVars, type CssVars } from './lib/css-vars';` with `export { cssVars, type CssVars } from '@ngaf/design-tokens';`
- `src/lib/css-vars.spec.ts`: moved to design-tokens (already covers light + dark resolution)
- All React component exports unchanged: `ThemeProvider`, `useTheme`, `<ThemedFrame>`, `useEmbeddedTheme`, `<ThemeToggle>`

**`@ngaf/example-layouts`:** patch bump (0.0.x + 1)
- `src/lib/install-embedded-theme.ts`: new file — pure TS, no Angular
- `src/lib/install-embedded-theme.spec.ts`: new unit tests
- `theme.css`: new file at lib root (exported via package.json `exports` field)
- `src/index.ts`: re-export `installEmbeddedTheme`
- `package.json`: add `exports` entry for `./theme.css`; add `tailwindcss` as a `peerDependency` (or `devDependency` plus rely on consuming apps to provide it)
- Existing `example-chat-layout.component.ts` and `example-split-layout.component.ts` — verify they don't need theme changes. Likely they hardcode some dark colors that need to migrate to `var(--ds-*)`.

## Public surface additions

```ts
// @ngaf/design-tokens
export { cssVars, type CssVars } from './lib/css-vars';

// @ngaf/example-layouts
export { installEmbeddedTheme } from './lib/install-embedded-theme';
// Also exports the CSS file via package.json exports map:
// "exports": { "./theme.css": "./src/theme.css", ... }
```

## `installEmbeddedTheme` contract

```ts
import { cssVars, type Theme } from '@ngaf/design-tokens';

export function installEmbeddedTheme(defaultTheme: Theme = 'dark'): void {
  const apply = (theme: Theme) => {
    document.documentElement.dataset.theme = theme;
    const vars = cssVars(theme) as Record<string, string>;
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k, v);
    }
  };
  apply(defaultTheme);
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'ngaf:theme' &&
        (e.data.theme === 'light' || e.data.theme === 'dark')) {
      apply(e.data.theme);
    }
  });
  window.parent?.postMessage({ type: 'ngaf:theme-request' }, '*');
}
```

Idempotent on subsequent message receipts (re-applying the same theme is a no-op visually). No cleanup function needed — the iframe document's lifecycle is bounded by the iframe itself.

## Per-app changes (pilot + each wave)

Each of the 32 apps needs the same five-step migration:

1. **`src/index.html`** — drop the v3 CDN script tag, remove `bg-gray-950 text-gray-100` from `<body>` (the body inherits `--ds-canvas`/`--ds-text-primary` via inline style on `<html>` instead). Leave the rest of `<head>` alone.

2. **`src/styles.css`** — replace contents with `@import "@ngaf/example-layouts/theme.css";`. If the app has custom global styles, keep them below the import.

3. **`src/main.ts`** — add `import { installEmbeddedTheme } from '@ngaf/example-layouts'; installEmbeddedTheme();` before `bootstrapApplication(...)`.

4. **Component templates** — replace dark-only Tailwind utilities and `--chat-*` variable references:
   - `bg-gray-950` → `bg-[var(--ds-canvas)]`
   - `text-gray-100` → `text-[var(--ds-text-primary)]`
   - `text-gray-400` → `text-[var(--ds-text-secondary)]`
   - `text-gray-500` → `text-[var(--ds-text-muted)]`
   - `border-gray-800` → `border-[var(--ds-border)]`
   - `bg-gray-900` → `bg-[var(--ds-surface)]`
   - Inline `style="background: var(--chat-bg, #171717)"` → `style="background: var(--ds-canvas)"` (drop the fallback; if vars aren't set the app fails loudly, which is the right signal)
   - Inline `style="color: var(--chat-text-muted, #777)"` → `style="color: var(--ds-text-muted)"`
   The exact mapping is captured in a sed-style table in the implementation plan; each app applies the same replacements.

5. **Project.json / build verification** — confirm the Angular build sees the new `@ngaf/example-layouts/theme.css` and runs Tailwind v4 against the app's templates. May require adding `@tailwindcss/postcss` (or `@tailwindcss/vite`, depending on the Angular builder's underlying tool) to the app or workspace devDeps.

## Pilot

The pilot app is **`cockpit/chat/timeline`**. Reasons:
- Uses `@ngaf/example-layouts` (`ExampleChatLayoutComponent`) — exercises the centralized layout path
- Renders both `<chat>` (sophisticated component with its own CSS) and `<chat-timeline-slider>` (interactive control) — surfaces issues with nested component theming
- Has visible sidebar surfaces with `--chat-*` variable references — exercises the migration mapping
- Currently visible from cockpit's `langgraph/streaming` capability? Need to confirm the runtime URL / which capability the chat-timeline app maps to in the manifest. Confirm at plan time.

Pilot success criteria:
- App loads with `data-theme="dark"`, all colors match cockpit's dark palette
- Cockpit toggle to light flips the embedded iframe to light within ~50ms (postMessage round-trip)
- Cockpit toggle back to dark flips embedded iframe back
- No visual regression: in either theme, the app is legible, contrast is acceptable, no left-over `#171717` hardcoded fallbacks bleeding through
- Chrome MCP smoke captures screenshots of the app in cockpit at light + dark; user reviews and signs off before wave 2

## Waves (post-pilot)

Once the pilot is approved, the remaining 31 apps go in waves grouped by library:

- **Wave 1: chat** — 11 apps (messages, tool-calls, subagents, input, a2ui*, theming, threads, interrupts, generative-ui, debug)
- **Wave 2: langgraph** — 8 apps (memory, durable-execution, streaming, subgraphs, deployment-runtime, interrupts, persistence, time-travel)
- **Wave 3: deep-agents** — 6 apps (sandboxes, subagents, memory, planning, filesystem, skills)
- **Wave 4: render + ag-ui** — 7 apps (computed-functions, element-rendering, repeat-loops, shared, state-management, spec-rendering, registry, streaming)

(*a2ui is the lone non-`@ngaf/example-layouts` consumer — it imports `installEmbeddedTheme` directly in its `main.ts` instead of relying on the layout component to call it.)

Each wave is one PR. Within a wave, all apps follow the same five-step migration. Pure mechanical work; high subagent batching potential.

## Testing

**Unit:**
- `@ngaf/design-tokens` `cssVars(theme)` tests (moved from ui-react, no behavior change — same 9 assertions)
- `@ngaf/example-layouts` `installEmbeddedTheme` tests:
  - Applies default theme on call (data-theme + style attributes set)
  - Updates on `ngaf:theme` message receipt
  - Ignores malformed/unrelated messages
  - Posts `ngaf:theme-request` to `window.parent` on call

**Per-app build verification:**
- `pnpm nx build <app-project>` succeeds after migration
- No reference to `bg-gray-950`, `text-gray-100`, `var(--chat-bg)`, hardcoded `#171717` etc. remain (grep gate in plan)

**Chrome MCP smoke (pilot + each wave):**
1. `pnpm nx serve cockpit` + the wave's example apps (each app on its own dev port from the manifest)
2. Open chrome to `http://localhost:4201/<capability-route>`
3. Screenshot dark mode (default)
4. Click cockpit's sidebar-footer theme toggle
5. Screenshot light mode
6. Eyeball both — checking: contrast legibility, no hardcoded-dark bleed-through, layout intact, interactive controls visible/usable in both
7. Repeat for every app in the wave
8. Capture screenshots into `docs/superpowers/screenshots/<date>-<app>/` for review

This is genuinely time-consuming for 32 apps. The pilot does it manually as the gate; the waves can be partly automated (chrome MCP scripted loop that visits each capability + screenshots both themes) but final visual judgment is human.

## Risks and mitigations

- **`cssVars` move breaks consumers** — only one consumer in the workspace (cockpit's `layout.tsx`); compiler will flag the missed import. Mitigated by one-line patch in same PR.
- **Tailwind v4 `@source` doesn't pick up Angular templates** — verify against the website's existing v4 config; if v4 default scanning isn't sufficient, add explicit `@source "src/**/*.{ts,html}"` in the `theme.css`.
- **Removing fallback hardcoded colors causes white-on-white** if `installEmbeddedTheme()` fails to run — mitigated by setting the default theme synchronously before bootstrap; if the function throws, we fail loudly rather than render with stale defaults.
- **`--chat-*` variables in the chat library itself** still drive internal chat-component theming — out of scope for this work. Examples migrate AWAY from `--chat-*` in their own templates; the library can continue to use them internally. If the chat library's internal styling is dark-locked, that's tracked as a follow-up.
- **Per-app build pipeline drift** — each Angular app may have slightly different `project.json` config. The plan's first task validates the pattern on the pilot; waves follow the validated pattern.

## Out-of-scope follow-ups (track but defer)

- Chat library internal `--chat-*` variables — migrate to consume `--ds-*` instead of having parallel namespace
- `index.html` `<base href="/">` tag review — some apps may need adjustment when iframed
- Example app SEO / favicons / manifest — not theming-related but probably need attention soon
- Migration of `apps/cockpit` itself to whatever theming pattern emerges if these examples reveal something cleaner
