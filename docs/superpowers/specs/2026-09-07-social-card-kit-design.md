# Social card kit: the framed product card

Date: 2026-09-07. Status: approved in conversation. Supersedes the card design documented in the header of `apps/website/src/app/opengraph-image.tsx`.

## Problem

The share card advertises a product that looks nothing like it. The website is hardwired light: the hero is flat white and all 150 docs pages are light, with one dark proof band as the only exception. The card is dark, centred, and built from a thick seam and a radial glow that appear nowhere else on the site. It also uses none of the site's signature devices, and its only product claim is text.

The card family has drifted besides. There are two generated cards and they share no code:

| Surface | Ground | Devices |
| --- | --- | --- |
| Default card, all marketing and 150 docs pages | `#161616 → #0e0e0e` | seam, glow, emoji wordmark, pills |
| Blog card, per post | `#0b0d12`, a value used nowhere else | none |

Two further brand assets are off-palette and carry retired taglines: the README banner (`public/assets/hero.svg`, deep navy with periwinkle, "Production-ready agent UI") and the whitepaper cover (`public/whitepaper-preview.html`, light gradient with `#004090`, "Enterprise Angular Agent UI"). Both are out of scope here and tracked as follow-ups.

## Decision

One card kit, on the site's own light surface, showing the product inside the site's own browser frame.

**Layout** (1200×630, verified by reference render):

- Ground `#fbfbfb`, the site's tinted surface.
- Left column, 585px wide, 64px gutter: a 92×3 `#1c1c1c` rail rule; a mono uppercase eyebrow at 19px, `0.12em`, in `#004090`; the tagline from `HERO_H1_LINES` in Garamond 700 at 60px, `-0.02em`, on its three lines; `HERO_SUBHEAD` at 24px in `#464646`; the runtime and licence pills; the wordmark.
- The browser frame is absolutely positioned at `top: 120, left: 640, width: 700`, so it bleeds off both the right and bottom edges. Titlebar with the three traffic lights and a mono URL pill reading `demo.threadplane.ai`, then the art.
- The art is the human-approval moment: the amber "AGENT PAUSED — REVIEW NEEDED" panel with its four buttons, over the backup table.

**Why the approval beat.** At feed scale, roughly 0.42×, no prose inside the frame is readable, and that is accepted. What survives is shape: an amber alert bar, four buttons, a table. That reads as a real product pausing for a human, which is the claim the copy makes.

**Brand mark.** The airplane is currently the system emoji, which renders as a different picture on every platform. Replace it with a monochrome vector paper-plane glyph at `public/brand/mark.svg`, used by the card, the nav `LogoMark`, and the favicon, so all three finally agree.

## Constraints discovered while prototyping

**Satori cannot render WebP.** Embedding a WebP data URI kills the render worker: no error, no response, the connection simply closes while the server survives. The identical image as PNG renders correctly. Every screenshot in `public/screenshots` is WebP, so the card art must be PNG.

The art is therefore generated, not hand-cut. A committed script crops the source WebP with `sharp` and writes PNG art to `public/card-art/`, which is checked in. Runtime conversion is rejected: it would put an image codec on every card render, and the checked-in PNG keeps the render path a plain file read that Vercel's file tracer can follow, which is the same constraint that already governs the bundled Garamond.

**Two of the three fonts are fetched at render time.** Garamond is bundled next to `og-font.ts` for reasons documented there, but Inter and JetBrains Mono are scraped from Google Fonts on every card render. In a sandbox without egress every mockup fell back to Garamond, including the eyebrow and body. Bundle both alongside Garamond and keep the network fetch only as a fallback.

## Structure

A new `apps/website/src/app/card/` module owns the kit, and both routes consume it:

- `tokens.ts` — the light-surface literals, resolved from the design tokens because Satori cannot read CSS variables, with the same "re-resolve if these change" note the current card carries.
- `chrome.tsx` — `Frame`, `Rail`, `Wordmark`, `Pills`. Each is a Satori-safe component, meaning every div carries an explicit `display`.
- `art.ts` — reads a named PNG from `public/card-art/` and returns a data URI, colocated so the tracer resolves it.
- `fonts.ts` — absorbs `og-font.ts`, adding bundled Inter and mono.

`opengraph-image.tsx` becomes the framed card. The blog card keeps its title-led layout but is rebuilt on the kit, which fixes its off-palette ground for free. Per-section docs cards become cheap afterwards and are deliberately not built now.

## Testing

- A unit spec asserts every art file the kit names exists on disk with the dimensions the layout assumes, so a re-cut crop cannot silently letterbox a card.
- A unit spec asserts the card copy still derives from `positioning.ts` rather than retyped strings, matching the existing guard on the tagline.
- An end-to-end check asserts `/opengraph-image` returns 200 with `image/png`. The blog cards are prerendered, so a Satori rejection there already fails the build.
- The existing `site-metadata.spec.ts` alt-text assertions are updated to the new alt text.

## Out of scope

The README banner and the whitepaper cover, both stale and off-palette. Per-section docs cards. Any change to the tagline or description, which shipped on 2026-09-06.
