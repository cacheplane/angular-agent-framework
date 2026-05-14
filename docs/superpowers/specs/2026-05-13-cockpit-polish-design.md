# Cockpit Polish — Design

**Date:** 2026-05-13
**Status:** Spec — pending implementation plan
**Spec series:** First in a three-PR sequence (cockpit polish → chat lib polish → cockpit ↔ website style alignment)

## Goal

Tighten cockpit's dark-mode-correctness, divider/border patterns, and standardize the chat library's theme-attribute API. Land the pilot's chrome-MCP-surfaced fixes in a single reviewable PR, and use the work as a forcing function to surface chat lib follow-ups for PR 2.

Out of scope:
- Chat lib internals beyond renaming `data-ngaf-chat-theme` → `data-theme` (the text-wrap bug, message-bubble width handling, and other chat lib polish are tracked for PR 2)
- Marketing website alignment (PR 3)
- New design-tokens entries (use existing tokens; accept tiny alpha shifts for consistency)
- Migration of `cockpit/<library>/<capability>/angular/` example apps beyond the timeline pilot (Stage 2 of the examples theme sync work, separate spec)

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Chat lib theme attribute | Rename `[data-ngaf-chat-theme]` → `[data-theme]`. Keep the `prefers-color-scheme: dark` cascade. No JS API. |
| 2 | Border/divider convention in cockpit | Tailwind arbitrary values (`border-b border-[var(--ds-border)]`). Migrate the ~5 inline-style holdouts. |
| 3 | Hardcoded color mapping in `cockpit.css` | Use existing `--ds-*` tokens. Accept ≤0.04 alpha shifts. No new tokens added. |
| 4 | Backwards compatibility | None. Drop shadcn-style aliases (`--muted`, `--border`, `--input`) in favor of `--ds-*` references at consumer sites. |
| 5 | `installEmbeddedTheme()` cleanup | Remove the redundant `data-ngaf-chat-theme` set added in the uncommitted in-flight change. After the rename, `data-theme` is sufficient. |

## Architecture

**Chat lib three-layer cascade** (consumer-facing contract):

```css
/* L1: Default fallback */
:root { /* LIGHT_TOKENS */ }

/* L2: OS preference — kicks in only if L3 is unset */
@media (prefers-color-scheme: dark) {
  :root { /* DARK_TOKENS */ }
}

/* L3: Programmatic override — highest specificity, always wins */
[data-theme="light"] { /* LIGHT_TOKENS */ }
[data-theme="dark"]  { /* DARK_TOKENS */ }
```

`[data-theme="dark"]` selector specificity (0,1,0,0) > `:root` (0,0,0,0). Programmatic override always wins regardless of source order or OS preference. Consumers who don't wire up `data-theme` get OS-preference behavior automatically.

**Cockpit token discipline:**

- All cockpit-app colors must be `var(--ds-*)` references or theme-flipping computed colors. No `rgba(0, 64, 144, X)` literals (the navy is light-theme accent — flips to bright blue in dark via `--ds-accent`). No `rgba(26, 27, 38, X)` literals (the dark canvas — flips to light surface via `--ds-surface`).
- Drop the shadcn-style alias vars (`--muted`, `--border`, `--input`) currently defined in `cockpit.css :root`. Migrate consumers to `--ds-*` directly.

**Border pattern:**

- Cockpit uses Tailwind arbitrary values for borders. Pattern: `className="border-b border-[var(--ds-border)]"`.
- No inline `style={{ borderBottom: '1px solid var(--ds-border)' }}` in cockpit components.
- This pattern was already dominant; the change is migrating the small number of inline-style holdouts.

## Package changes

**`@ngaf/chat`:** patch bump
- `src/lib/styles/chat-tokens.ts`: rename `[data-ngaf-chat-theme="light"]` → `[data-theme="light"]`, same for dark. The `:root` and `prefers-color-scheme` blocks remain unchanged.
- No other chat lib changes (text-wrap bug etc. → PR 2).

**`@ngaf/example-layouts`:** patch bump
- `src/lib/install-embedded-theme.ts`: remove the `document.documentElement.dataset.ngafChatTheme = theme;` line and its comment. The existing `data-theme` set now drives both design-tokens and chat lib via the renamed selector.
- Update `theme.css` if any namespace bridge references need adjusting (probably none — bridge stays at `:root` since it's now redundant for chat lib's own theming but still useful for visual cohesion if/when PR 3 unifies palettes).

**`apps/cockpit`:**
- `src/components/cockpit-shell.tsx`: keep the edge-to-edge content padding change. Migrate the inline `style={{ borderBottom: '1px solid var(--ds-border)' }}` to Tailwind class.
- `src/components/sidebar/cockpit-sidebar.tsx`: migrate any inline border styles to Tailwind classes.
- `src/app/cockpit.css`:
  - Drop `--muted`, `--border`, `--input` aliases from `:root` block.
  - Replace all `rgba(0, 64, 144, X)` literals with `var(--ds-accent-surface)` (alpha 0.04 / 0.06 sites) or `var(--ds-accent-border)` (alpha 0.12 / 0.15 sites).
  - Replace `rgba(26, 27, 38, 0.95)` (line 142, dark-assumed) with `var(--ds-surface)`.

## Per-file changes (summary table)

| File | Change |
|---|---|
| `libs/chat/src/lib/styles/chat-tokens.ts` | Attribute selector rename only |
| `libs/example-layouts/src/lib/install-embedded-theme.ts` | Remove `dataset.ngafChatTheme` line |
| `apps/cockpit/src/components/cockpit-shell.tsx` | Border inline → Tailwind class; preserve edge-to-edge padding |
| `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` | Border inline → Tailwind class wherever present |
| `apps/cockpit/src/app/cockpit.css` | Replace literals with tokens; drop shadcn aliases |
| Any cockpit consumer of `--muted` / `--border` / `--input` | Migrate to `--ds-*` (grep to find) |
| `libs/chat/package.json` | Patch bump |
| `libs/example-layouts/package.json` | Patch bump |

## Verification

**Unit:** `pnpm nx test chat example-layouts cockpit` — green.

**Visual smoke (chrome MCP):**
1. Cockpit on 3000, timeline angular on 4507 (pilot already wired)
2. Navigate to `chat/core-capabilities/timeline/overview/python` (the chat-timeline capability)
3. Dark mode (default): all surfaces use design-tokens dark palette, no white callouts bleeding through
4. Toggle to light: same — no dark-assumed code-block backgrounds bleeding through
5. Chat input area (in iframe) follows host theme — bg matches surrounding shell
6. No inline `style={{ borderBottom }}` survives anywhere in cockpit components (grep gate)
7. No `rgba(0, 64, 144` or `rgba(26, 27, 38` literals in `cockpit.css` (grep gate)

## Risks and mitigations

- **Chat lib attribute rename is breaking** for any external consumer that explicitly set `data-ngaf-chat-theme`. Acceptable per "no backwards compat" decision. Patch bump signal is sufficient for now; we're 0.0.x.
- **Shadcn alias removal** could break code that references `--muted` / `--border` / `--input` directly. Mitigated by grep sweep before removing, plus typecheck (CSS vars are runtime not type-checked, but TS/TSX files that reference them via `style` or `className` would still work — they're just strings). Visual smoke catches regressions.
- **Alpha shifts** (0.04 → 0.06, 0.12 → 0.15) might look slightly different in some callouts. Mitigated by visual smoke; tiny shifts at low-alpha values are imperceptible.
- **`theme.css` namespace bridge becomes partially redundant** in the embedded apps after the rename — chat lib's own `[data-theme="dark"]` rule now takes priority over the bridge's `:root` mapping. Chat appears in its OWN dark palette (not design-tokens dark). Acceptable for this PR; visual unification is PR 3 scope.

## Out-of-scope follow-ups (track but defer)

- Chat lib text-wrap bug (`"hello"` rendering as `hel`/`lo`) — PR 2
- Chat lib internal palette migration to `var(--ds-*)` — PR 3 or later
- Doc h1/h2/h3 size tokenization (style analysis recommendation #4) — PR 3
- Website migration to `cssVars('light')` from hardcoded hex (style analysis recommendation #3) — PR 3
- Stage 2 (remaining 31 example apps) — separate plan/spec already drafted in earlier spec
