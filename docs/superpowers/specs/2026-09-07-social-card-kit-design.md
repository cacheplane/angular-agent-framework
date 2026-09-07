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
- Left column, 600px wide, 64px gutter: a 92×3 `#1c1c1c` rail rule; a mono uppercase eyebrow at 19px, `0.12em`, in `#004090`; the tagline from `HERO_H1_LINES` in Garamond 700 at 60px, `-0.02em`, on its three lines; `HERO_SUBHEAD` at 24px in `#464646`; the runtime and licence pills; the wordmark.
- The browser frame is absolutely positioned at `top: 150, left: 656, width: 480`, so its size never moves when the copy reflows. Titlebar with the three traffic lights and a mono URL pill reading `demo.threadplane.ai`, then the conversation.
- The frame is fully contained rather than bled off the edge. A bleed showed more product but cut the message mid-word, which reads as broken rather than as a crop.
- The conversation is three beats and nothing else: the user asks to delete the stale backups, the agent answers with the size and the warning, and an Approve/Decline pair waits on a human.

**The frame is drawn, not screenshotted.** Every screenshot we own carries a sidebar, a devtools panel, or a table of storage paths. Cropping one trades the clutter for a fragment, and at feed scale the remainder is grey noise. Drawing the conversation means every size clears the readable floor and the picture says one thing: an agent proposed an irreversible action and stopped for a human. That is the claim the copy makes, so it is the only thing the frame shows.

**Brand mark.** The airplane was the system emoji, a different picture on every platform, so the brand had no stable mark. It is replaced by a drawn paper plane shared by every surface: `PlaneMark` for the wordmark in the nav and footer, an inline copy in the card, `src/app/icon.svg` as the square app icon browsers request as the favicon, a regenerated `favicon.ico`, and `public/brand/logo-512.png`, which finally lets the Organization structured data assert a `logo`.

## Constraints discovered while prototyping

**Satori cannot render WebP.** Embedding a WebP data URI kills the render worker: no error, no response, the connection simply closes while the server survives. The identical image as PNG renders correctly. Every screenshot in `public/screenshots` is WebP. This is recorded because it will surface again the moment someone reaches for a screenshot in a card, and because the failure gives no clue what went wrong.

**Two of the three fonts were fetched at render time.** Garamond was bundled; Inter and JetBrains Mono were scraped from the Google Fonts CSS API on every render. That is a network round trip inside an image render, and it fails silently: the card comes out in whichever faces happened to load. It was not theoretical. A prototype rendered its mono eyebrow and pills in serif because that fetch failed, and nothing reported it.

All four faces are now bundled, built by `scripts/build-card-fonts.py`, which supersedes `instance-garamond.py`. Each is instanced to one weight, stripped of the variable tables Satori cannot parse, and subset to Latin plus the punctuation the site uses. The four together come to 359KB, less than the single unsubsetted Garamond they replace. `loadGoogleFont` stays for a face we do not bundle, but no card depends on it.

## Structure

`apps/website/src/app/card/` owns the kit, and both routes render through it:

- `tokens.ts` — the light-surface literals, resolved from the design tokens because Satori cannot read CSS variables, plus the readable-type floor.
- `chrome.tsx` — `Rail`, `Frame`, `Conversation`, `Pills`, `Wordmark`, `Plane`. Satori-safe: every element carries an explicit `display`.
- `fonts/` — the four TTFs and the module that reads them, colocated so the file tracer resolves each by a literal filename. A loop over a list of names would not trace.

The default card becomes the framed card. The blog card keeps its title-led layout but is rebuilt on the kit, which moves it onto the site's ground and gives it the wordmark. Per-section docs cards are now cheap and deliberately not built.

The kit is added to the inline-style rule's ignore list in `eslint.config.mjs`, alongside the two card routes already there, for the same reason: Satori has no stylesheet.

## Testing

- `card.spec.ts` asserts every colour in `CARD` still equals the design token it was copied from, parsed out of `theme.css`. A hand-copied palette with nothing checking it goes stale silently: the card keeps rendering, in last season's colours.
- The same spec asserts all four fonts are present and are static rather than variable. A missing face does not fail a render, it degrades one, so nothing else would catch it.
- It also asserts the alt text quotes the positioning copy rather than retyping it, and describes the approval rather than only naming the product.
- An end-to-end check asserts `/opengraph-image` returns 200 with `image/png`. The blog cards are prerendered, so a Satori rejection there already fails the build; the default card is rendered at request time and needs a runtime check.
- Both guards were mutation-tested: breaking a token and removing a font each fail the suite.

## Out of scope

The README banner (`public/assets/hero.svg`) and the whitepaper cover (`public/whitepaper-preview.html`), both stale and off-palette, and both still carrying retired taglines. Per-section docs cards. Any change to the tagline or description, which shipped on 2026-09-06.
