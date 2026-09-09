# "For teams" becomes the briefing block

**Date:** 2026-09-08
**Status:** Approved, ready for planning
**Component:** `apps/website/src/components/landing/TeamsBlock.tsx`
**Follows:** `2026-09-08-fork-us-band-design.md` (the band directly above it)

## 1. Why

The section's job is the field report download, with contact as the secondary ask. Measured on the live page at 1440px, it does the opposite of that:

| | |
| --- | --- |
| Section height | 916px |
| The 01–04 timeline | starts at y=115 — the top of the aside |
| Field report card | y=445 |
| **The form** | **y=618** |
| "Talk to an engineer" | y=667, 8,789px² |
| "Get the field report" | 8,525px² |

Three problems. The **primary conversion goal sits two-thirds down the section**. The two CTAs are within 3% of each other in visual weight, so nothing signals which ask matters. And the most valuable real estate — the top of the aside — is spent on a four-step timeline that `/pilot-to-prod` already covers in full, with week numbers.

## 2. The copy was also wrong

Checked against the shipped `apps/website/public/whitepaper.pdf`:

| Claimed | Actual |
| --- | --- |
| "18 pages" (3 places) | **17 pages** — `pdfinfo` and a page-break count agree |
| "Error boundaries, fallbacks, observability, deploy" | **`error boundar` 0 hits, `fallback` 0 hits, `observab` 0 hits** in the document |

The six chapters are: **Streaming State Management · Thread Persistence · Tool-Call Rendering · Human Approval Flows · Generative UI · Deterministic Testing.**

Three of the four topics named in exchange for an email address appear nowhere in what gets sent. That is the strongest argument for the design below: **the briefing preview renders the real table of contents**, so the claim and the artifact cannot drift apart again.

## 3. Shape

Two elements side by side, with the secondary ask beneath both:

```
PREFLIGHT BRIEFING · 17 PAGES · FREE        ┌─────────────────────┐
                                            │ THREADPLANE · OSS   │
What breaks between                         │ From Prototype      │
a demo and production.                      │ to Production       │
                                            │ CONTENTS            │
[ you@company.com ] [ Get the field report ]│ 01 Streaming State… │
<the form's own disclosure>                 │ 02 Thread Persist…  │
                                            │ …06 Deterministic…  │
────────────────────────────────────────────└─────────────────────┘
Shipping inside a large Angular platform? …      Talk to an engineer →
```

Grid is `minmax(0, 1fr) 400px` with a 64px gap, centre-aligned, collapsing to one column at 900px. The teams line spans the full width beneath, above a `1px` top border.

**The heading sells; the cover identifies.** The `<h2>` is *"What breaks between a demo and production."* — the report's own title lives on the cover, so the heading earns its size instead of restating the artwork beside it.

**No description line.** The eyebrow gives length and price, the heading gives the value, the cover gives the contents. A fourth line would repeat one of them.

## 4. The briefing preview

Reuses the existing `.wp-paper` visual language from `WhitePaperBlock` — the same `rotate(-1.2deg)`, border, radius and two-layer shadow — so it reads as the same object the library pages already show. What changes is the content: instead of a badge and one line of description, it renders the document's real front matter and table of contents.

**It is not `aria-hidden`.** The existing `.wp-cover-wrap` is decorative artwork and hides itself from assistive tech; this one carries the table of contents, which is the actual reason to download. Hiding it would withhold the substance from screen reader users. The cover title is an `<h3>` and the contents are an `<ol>`, so both join the document outline.

## 5. Where the facts live, and the guard that makes them un-driftable

The page count and the six chapter titles are one data module — `apps/website/src/lib/field-report.ts` — read by both the eyebrow and the cover. The eyebrow's "17 pages" is **derived from it, not typed**, so the guard below covers the rendered string as well as the data.

The page count is asserted against the PDF at test time, dependency-free:

```ts
const pdf = readFileSync('apps/website/public/whitepaper.pdf', 'latin1');
const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
expect(FIELD_REPORT.pages).toBe(pages);
```

Verified: both this regex and `pdfinfo` return 17. Regenerating the PDF at a different length now fails the suite instead of silently making the homepage lie.

**The chapter titles cannot be guarded the same way** — the text lives in compressed streams and extracting it needs a dependency CI does not have. They are verified manually; the command is recorded here so the next person does not have to rediscover it:

```bash
pdftotext -f 1 -l 2 apps/website/public/whitepaper.pdf - | sed -n '1,40p'
```

## 6. Scope beyond the section

`WhitePaperBlock` — used by the four library pages — carries the **same two false claims** (`18 pages`, and `Error boundaries, fallbacks, observability, deploy`). Correcting only the homepage would knowingly leave them live elsewhere, so both strings are fixed there too. The block's layout is otherwise untouched.

## 7. What gets cut

- **The 01–04 timeline.** `/pilot-to-prod` covers it in full. The homepage version earned nothing and occupied the top of the aside.
- **The four outcome rows.** They describe the pilot engagement, now carried by one sentence.
- **"See the pilot program" button.** `/pilot-to-prod` is in the primary nav (`Nav.tsx:19`) and the footer, so it is not orphaned.
- **The report card wrapper** (`.teams-report`, `-badge`, `-title`, `-desc`). The report is the section now; it does not need a box inside it.

**Contact steps down from button to link.** Two equal-weight buttons is what stopped today's section saying which ask matters.

## 8. Identifiers, tests and analytics

- The `<h2>` id changes from `pilot-heading` to `field-report-heading`, and **`e2e/website.spec.ts:57` is updated in the same commit.** The spine exists to catch accidental removals; this rename is deliberate. It is the only test edit this change makes.
- `teams-report-heading` disappears; nothing outside the component references it.
- The section keeps `id="teams"`, its `tinted` surface and its position in `page.tsx`.
- **Analytics keys are unchanged** so the funnel stays continuous: the form keeps `surface="home_whitepaper"` and `sourceSection="teams-block"`, and the contact link keeps `cta_id: 'hero_talk_to_engineers'` despite becoming a link.
- The form's own disclosure (`formPolicy.disclosures.whitepaper`) and its "Already on the list?" direct-download line are rendered by `WhitePaperForm` and must not be duplicated in the section.

## 9. Noted, not fixed here

`WhitePaperBlock` claims *"No vendor pitch — what we learned shipping it."* Per `docs/superpowers/plans/2026-04-05-whitepaper-pipeline.md`, the document's six chapters were generated by a script calling the Anthropic API. "What we learned shipping it" is therefore hard to defend as written. It is **not** carried into the new section, and it is left alone on the library pages rather than quietly reworded, because whether to rewrite it or to rewrite the document is a call for the owner rather than a copy edit.

## 10. Verification

- `npx nx test website`, `npx nx lint website`, `npx nx build website`.
- `npx nx e2e website`, with `field-report-heading` in the spine and everything else passing unchanged.
- Measured in a browser, not eyeballed: the form sits **above y≈300** in the section (today it is at 618), the cover's contents list shows six entries, and the heading shares the container's left edge with `#proof-heading`.
- At 390px the grid collapses to one column, the cover does not overflow, and the form's input and button stack without clipping.
