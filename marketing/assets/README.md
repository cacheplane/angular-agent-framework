# @threadplane/marketing-assets

Branded social-card rendering for the marketing pipeline. `renderCard()` turns typed input into a PNG via satori (JSX→SVG) + @resvg/resvg-js (SVG→PNG). No Next.js dependency — runs anywhere Node does.

## Usage

```ts
import { renderCard } from '@threadplane/marketing-assets';

const card = await renderCard({
  template: 'x-card',
  title: 'Build a streaming chat UI in Angular with LangGraph',
  subtitle: 'Signal-native streaming, wired to a LangGraph backend.',
});
// card.png is a Buffer; card.width / card.height / card.contentType describe it.
```

The X channel adapter embeds `card.png` directly in `Draft.media`.

## Templates

| id | size | use |
|----|------|-----|
| `x-card` | 1200×675 | X in-stream image (16:9) |
| `og-card` | 1200×630 | standard OpenGraph / Dev.to cover |

Both share `CardShell`: eyebrow, Garamond headline, optional subtitle, footer with trust pills (or author byline) + the plane logo wordmark.

## Input

- `title` (required) — headline
- `subtitle` — supporting line
- `eyebrow` — kicker; defaults to "Agent UI for Angular · MIT"
- `author` — `{ name, role? }`; when set, replaces the trust pills

## Assets

- Fonts: bundled static TTFs in `fonts/` (Garamond 700, Inter 400/600). No runtime fetch.
- Logo: `brand/plane.png`, rendered as an `<img>` data-URI (satori can't render the emoji glyph).
- Both dirs are copied into `dist/` by the Nx build assets array.

## Adding a template

1. Add a TSX wrapper in `src/templates/` calling `CardShell` with size params.
2. Register it in `src/templates/registry.ts` with width/height.
3. Add its id to `TemplateId` in `src/types.ts`.
4. Add a sample to `scripts/preview.ts`.

## Preview

```bash
npx tsx --tsconfig marketing/assets/tsconfig.lib.json marketing/assets/scripts/preview.ts
```

The `--tsconfig` flag points tsx at the JSX runtime config for the `.tsx` templates (the workspace-root tsconfig has no `jsx` setting). Writes sample PNGs to `marketing/assets/preview/` (gitignored). Open them to eyeball layout/fonts/logo.

## See also

- Spec: `docs/superpowers/specs/marketing/2026-05-17-brand-assets-design.md`
- Meta: `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`
