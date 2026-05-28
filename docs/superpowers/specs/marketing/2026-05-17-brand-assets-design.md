---
workstream: brand-assets
status: approved
owner: brian
phase: 1
spec: docs/superpowers/specs/marketing/2026-05-17-brand-assets-design.md
plan: docs/superpowers/plans/marketing/2026-05-17-brand-assets.md
parent: docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md
---

# Brand Assets (Design)

> Sub-spec 1 of the marketing umbrella. Replace the `@ngaf/marketing-assets` skeleton with a real `renderCard()` that turns typed input into branded PNG social cards, built on satori + @resvg/resvg-js (standalone, no Next dependency). Ships 2 templates (`x-card`, `og-card`) sharing one brand-token source extracted from the website's existing OG card.

## 1. Goal

A standalone, internal library that renders branded social images from typed input. The immediate consumer is the X adapter (`@ngaf/marketing-channels`), which embeds the PNG bytes in `Draft.media`. The library shares the visual language of the website's OG cards but does NOT depend on Next.js — it runs in the agent's Node/LangGraph context.

## 2. Context

- Parent: `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md` §5.1.
- Existing skeleton: `marketing/assets/src/index.ts` exports `CardInput`/`RenderedCard` types + a `renderCard()` that throws.
- Existing OG infra to mirror (NOT depend on): `apps/website/src/app/opengraph-image.tsx` — a 1200×630 card via Next's `ImageResponse`, using a bundled `EBGaramond-Bold.ttf` plus Inter/JetBrains Mono fetched from Google Fonts. This sub-spec lifts that card's palette + layout into reusable tokens + templates.
- Decision: render with **satori** (JSX→SVG) + **@resvg/resvg-js** (SVG→PNG) — the same engines under `next/og`, used directly so the package carries no `next` dependency. `renderCard()` returns PNG bytes any consumer can use (the X adapter embeds them; the website OG routes could call it in a future migration).
- Decision: **defer migrating the website OG routes**. They keep using `next/og` ImageResponse (works today). Migration to `renderCard()` is a follow-up once the templates are proven. This removes any risk of regressing live share cards.
- Decision: **bundle fonts** in the package rather than fetching from Google Fonts at render time. Removes a network failure mode from the agent's render path and makes rendering deterministic on CI.

## 3. Scope

**In scope:**

- `renderCard(input: CardInput): Promise<RenderedCard>` implemented with satori + @resvg/resvg-js.
- Brand-token module (`brand.ts`) — colors, gradient, font families, wordmark — lifted verbatim from the website OG card so the visual language stays consistent.
- Bundled fonts: `EBGaramond-Bold.ttf` (copied from the website), `Inter-Regular.ttf`, `Inter-SemiBold.ttf`. No runtime font fetch.
- 2 templates:
  - `x-card` — 1200×675 (X's 16:9 in-stream ratio)
  - `og-card` — 1200×630 (standard OG ratio; mirrors the website default card)
- A shared `CardShell` component so the two templates don't duplicate chrome.
- Template registry mapping `TemplateId` → `{ component, width, height }`.
- Unit tests asserting valid PNG output + correct dimensions (read from the PNG IHDR chunk), both footer branches, unknown-template error, font memoization.
- `scripts/preview.ts` writing sample PNGs to `marketing/assets/preview/` (gitignored) for manual eyeballing.
- `marketing/assets/README.md`.

**Out of scope:**

- Migrating the website OG routes to `renderCard()` (deferred).
- Image hosting / upload-to-URL (separate concern; blocks Dev.to cover images, which inline images by URL).
- LinkedIn / square / story templates (no LinkedIn in the current channel set).
- Dark-mode or theme variants (v1 is the light gradient brand card only).
- Animated/video assets.
- Pixel-snapshot visual regression testing (brittle across resvg versions; we assert PNG-validity + dimensions and rely on the manual preview).

## 4. Architecture

```
marketing/assets/
├── package.json              # add deps: satori, @resvg/resvg-js; build assets array for fonts/
├── project.json              # add vitest test target
├── vite.config.mts           # NEW
├── README.md                 # NEW
├── fonts/                    # NEW — committed, copied into dist on build
│   ├── EBGaramond-Bold.ttf
│   ├── Inter-Regular.ttf
│   └── Inter-SemiBold.ttf
├── preview/                  # gitignored output (.gitkeep + .gitignore)
├── scripts/
│   └── preview.ts            # writes sample PNGs
└── src/
    ├── index.ts              # public API
    ├── types.ts              # TemplateId, CardInput, RenderedCard
    ├── brand.ts              # brand tokens
    ├── fonts.ts              # loadFonts() — memoized TTF reads
    ├── fonts.spec.ts
    ├── render.ts             # renderCard()
    ├── render.spec.ts
    └── templates/
        ├── card-shell.tsx    # shared layout
        ├── x-card.tsx        # 1200×675 wrapper
        ├── og-card.tsx       # 1200×630 wrapper
        └── registry.ts       # TEMPLATES map
```

Component responsibilities:

| File | Responsibility | Depends on |
|------|----------------|------------|
| `types.ts` | Public types | — |
| `brand.ts` | Palette / fonts / wordmark constants | — |
| `fonts.ts` | Read + memoize bundled TTFs as satori font entries | node:fs |
| `templates/card-shell.tsx` | The full card layout, parameterized by size | `brand.ts`, `types.ts` |
| `templates/x-card.tsx` | Thin wrapper: CardShell at 1200×675 | `card-shell.tsx` |
| `templates/og-card.tsx` | Thin wrapper: CardShell at 1200×630 | `card-shell.tsx` |
| `templates/registry.ts` | Map id → component + dimensions | template wrappers |
| `render.ts` | satori → resvg pipeline | `fonts.ts`, `registry.ts` |
| `index.ts` | Re-export `renderCard` + types | all above |

### Rendering pipeline (`render.ts`)

```ts
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts';
import { TEMPLATES } from './templates/registry';
import type { CardInput, RenderedCard } from './types';

export async function renderCard(input: CardInput): Promise<RenderedCard> {
  const entry = TEMPLATES[input.template];
  if (!entry) {
    throw new Error(
      `Unknown template "${input.template}". Known: ${Object.keys(TEMPLATES).join(', ')}.`,
    );
  }
  const fonts = await loadFonts();
  const svg = await satori(entry.component(input), {
    width: entry.width,
    height: entry.height,
    fonts,
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: entry.width } });
  const png = resvg.render().asPng();
  return {
    png: Buffer.from(png),
    width: entry.width,
    height: entry.height,
    contentType: 'image/png',
  };
}
```

### Font loading (`fonts.ts`)

Memoized. Reads the three bundled TTFs once per process. Resolves the `fonts/` dir relative to the compiled module location (`../fonts` from `dist/marketing/assets/src/`).

### Build wrinkle — fonts in dist

`@nx/js:tsc` emits only `.js`/`.d.ts`. The `fonts/` dir must be copied into `dist/`. Add an `assets` array to the `build` target in `project.json` (same pattern `libs/telemetry` uses for its README + package.json). Declared assets:

```json
"assets": [
  { "input": "marketing/assets/fonts", "glob": "**/*", "output": "fonts" }
]
```

This places the fonts at `dist/marketing/assets/fonts/`, matching the `../fonts` resolution from `dist/marketing/assets/src/fonts.js`.

### satori constraints

satori takes a React-element object (not rendered DOM) — no `react-dom`, no `renderToString`. Templates are plain functions returning JSX with **inline `style` only** (satori supports a flexbox subset; no class names, no external CSS). This matches how the website's `ImageResponse` templates already work. `tsconfig.lib.json` needs `"jsx": "react-jsx"` (or `"react"`); the package compiles `.tsx`.

## 5. Public API

```ts
// index.ts
export { renderCard } from './render';
export type { CardInput, RenderedCard, TemplateId } from './types';
```

```ts
// types.ts
export type TemplateId = 'x-card' | 'og-card';

export interface CardInput {
  template: TemplateId;
  /** Headline. Required. Garamond serif, large. */
  title: string;
  /** Supporting line under the headline. Optional. */
  subtitle?: string;
  /** Kicker above the headline. Optional. Defaults to "Agent UI for Angular · MIT". */
  eyebrow?: string;
  /** Bottom-left attribution. When present, replaces the trust pills. Optional. */
  author?: { name: string; role?: string };
}

export interface RenderedCard {
  png: Buffer;
  width: number;
  height: number;
  contentType: 'image/png';
}
```

(The meta's `tag` field is renamed `eyebrow` for clarity and to avoid collision with `Draft.article.tags`. `subtitle` and `author` carry over from the meta unchanged.)

## 6. Brand tokens (`brand.ts`)

```ts
export const brand = {
  gradient: 'linear-gradient(135deg, #fafbfc 0%, #eaf3ff 100%)',
  ink: '#1a1a2e',
  inkSoft: '#555770',
  accent: '#004090',
  angular: '#DD0031',
  wordmark: 'cacheplane.ai',
  glyph: '🛩️',
  serif: 'EB Garamond, Georgia, serif',
  sans: 'Inter, sans-serif',
  defaultEyebrow: 'Agent UI for Angular · MIT',
} as const;
```

Values lifted verbatim from `apps/website/src/app/opengraph-image.tsx` so the marketing cards and the site share one palette.

## 7. Template layout

Both templates render the same structure via `CardShell`, differing only in dimensions and headline size:

1. **Eyebrow** (top) — Inter 600, uppercase, `letter-spacing: 0.12em`, color `brand.accent`. Uses `input.eyebrow ?? brand.defaultEyebrow`.
2. **Headline** — `brand.serif` 700, `brand.ink`, `-0.02em` tracking, `maxWidth: 980`. `input.title`. Size: 76px on `x-card`, 72px on `og-card`.
3. **Subtitle** — Inter 400, ~26px, `brand.inkSoft`, `maxWidth: 920`, `marginBottom: auto` (pushes footer down). Rendered only when `input.subtitle` is set.
4. **Footer row** (bottom, `justify-content: space-between`):
   - **Left:** if `input.author` → `name` (Inter 600, ink) + ` · role` (Inter 400, inkSoft). Else → three trust pills (`MIT`, `LangGraph + AG-UI`, `Angular 20+`) reusing the website pill styling.
   - **Right:** `{brand.glyph} {brand.wordmark}` (Garamond 700, ink).

`CardShell({ input, headlineSize, padding })` renders all of the above. `XCard` = `CardShell({ input, headlineSize: 76, padding: '76px 84px' })`; `OgCard` = `CardShell({ input, headlineSize: 72, padding: '72px 80px' })`.

The pill component is a small local helper inside `card-shell.tsx` (lifted from the website's `PillBadge`), three tones: `accent`, `neutral`, `angular`.

## 8. Testing

`render.spec.ts`:
- `renderCard({ template: 'x-card', title: 'Hello' })` → `png` starts with PNG magic bytes `89 50 4E 47`; IHDR width=1200, height=675.
- `renderCard({ template: 'og-card', title: 'Hello' })` → IHDR width=1200, height=630.
- With `subtitle` set → valid PNG (subtitle branch).
- With `author` set → valid PNG (author footer branch).
- Title-only (no subtitle/author) → valid PNG (default eyebrow + trust-pill branch).
- Unknown template id → throws with the known-templates list.
- Test helper `readPngDimensions(buf)` parses the IHDR chunk (width = bytes 16-19 big-endian, height = bytes 20-23) to assert real dimensions, not just requested ones.

`fonts.spec.ts`:
- `loadFonts()` returns 3 entries with names `EB Garamond`/`Inter`/`Inter` and weights `700`/`400`/`600`.
- Second call returns the same array reference (memoization).

No pixel snapshots. PNG-validity + dimensions + the manual preview is the right level for v1.

## 9. Manual preview

`scripts/preview.ts` renders one sample of each template (with and without subtitle/author) and writes PNGs to `marketing/assets/preview/`. Run via `npx tsx marketing/assets/scripts/preview.ts`. Output dir is gitignored; only `.gitkeep` is committed. README documents the command.

## 10. Risks + non-goals

| # | Risk | Mitigation |
|--:|------|------------|
| 1 | `@resvg/resvg-js` native binary doesn't install on CI's platform | resvg-js ships prebuilt binaries for linux-x64/arm64 + darwin; same platforms CI + dev use. If a platform is missing, it falls back to a wasm build. Verify in the build step. |
| 2 | Emoji glyph (🛩️) doesn't render in satori without an emoji font | satori needs an explicit emoji font or a `loadAdditionalAsset` callback for emoji. If 🛩️ fails to render, fall back to a text wordmark with no glyph (the website card uses the glyph via ImageResponse which has emoji support built in; satori does not by default). Implementer tests this in the preview and drops the glyph if it doesn't render cleanly. |
| 3 | Bundled fonts bloat the package | ~1.5MB total, internal-only package, never published. Acceptable. |
| 4 | satori flexbox subset rejects a layout property used in the website card | satori supports the subset the website card already uses (flex, padding, gap, borderRadius, gradients via background). The card was authored against the same engine constraints. Low risk. |
| 5 | Fonts not copied into dist → runtime ENOENT | The `project.json` assets array handles this; the build test asserts `dist/marketing/assets/fonts/` exists. |

**Non-goals:** dark mode, video, image hosting, website-route migration, non-brand templates.

## 11. Phases

1. **Phase 0 — Deps + config + fonts.** Add satori + resvg deps, vitest config, copy the three TTFs into `fonts/`, wire the build assets array. ~2 commits.
2. **Phase 1 — Brand + fonts module (TDD).** `brand.ts`, `fonts.ts` + `fonts.spec.ts`. ~2 commits.
3. **Phase 2 — Templates.** `card-shell.tsx`, `x-card.tsx`, `og-card.tsx`, `registry.ts`. ~2 commits.
4. **Phase 3 — renderCard (TDD).** `render.ts` + `render.spec.ts`, `index.ts` rewrite. ~2 commits.
5. **Phase 4 — Preview + docs.** `scripts/preview.ts`, `preview/.gitkeep` + `.gitignore`, `README.md`. ~1 commit.
6. **Phase 5 — Verification.** Build (assert fonts in dist), tests, manual preview eyeball. No commit.

Total: ~9 commits.

## 12. Deliverables

- ☐ `marketing/assets/package.json` — satori + @resvg/resvg-js deps; build assets array
- ☐ `marketing/assets/project.json` — vitest test target
- ☐ `marketing/assets/vite.config.mts`
- ☐ `marketing/assets/fonts/{EBGaramond-Bold.ttf, Inter-Regular.ttf, Inter-SemiBold.ttf}`
- ☐ `marketing/assets/src/types.ts`
- ☐ `marketing/assets/src/brand.ts`
- ☐ `marketing/assets/src/fonts.ts` + `fonts.spec.ts`
- ☐ `marketing/assets/src/render.ts` + `render.spec.ts`
- ☐ `marketing/assets/src/templates/{card-shell,x-card,og-card,registry}.tsx`
- ☐ `marketing/assets/src/index.ts` rewritten
- ☐ `marketing/assets/scripts/preview.ts` + `preview/.gitkeep` + `preview/.gitignore`
- ☐ `marketing/assets/README.md`
- ☐ `nx run marketing-assets:build` green; `dist/marketing/assets/fonts/` populated
- ☐ `nx run marketing-assets:test` green
- ☐ Manual: `npx tsx marketing/assets/scripts/preview.ts` → eyeball both templates

## 13. References

- Parent: `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`
- Website OG card (palette + layout source): `apps/website/src/app/opengraph-image.tsx`
- satori: `https://github.com/vercel/satori`
- @resvg/resvg-js: `https://github.com/yisibl/resvg-js`
