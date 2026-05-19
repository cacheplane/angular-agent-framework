# "Why this exists" homepage section — redesign

**Status:** Design approved, ready for implementation plan.
**Owner:** apps/website
**Affects:** `apps/website/src/components/landing/Differentiator.tsx` (renamed/rewritten)

## Wedge

Streaming chat in a tutorial takes an hour. Shipping a real Angular agent — durable, interruptible, observable, on your design system — takes most teams six months. NGAF gives the Angular surface the rest of the agent stack assumes you've already built.

This is the **demo→production gap**, locked as the section's single argument. It is the wedge most distinct from `/pilot-to-prod` (which sells the *engagement* that walks teams across that gap) and from the hero (which announces the *product*).

## GTM alignment

- Matches Spec 2 (positioning-and-risks) lock on "Angular final mile" — does not claim a general agent framework.
- Reinforces the qualified-lead enterprise track: a buyer who reads the row list and recognizes their own production checklist self-qualifies and clicks through to `/pilot-to-prod` or `/contact`.
- Does not duplicate the `/pilot-to-prod` Discover → Build → Harden timeline; this section sets *what production-ready means* before the prospect arrives at the engagement page.

## Content

### Eyebrow
`Why this exists`

### Headline (h2)
`Everything an Angular agent needs once the demo works.`

### Subhead (≤ 2 sentences, body-lg)
> A streaming chat tutorial takes an hour. Shipping a real agent — durable, interruptible, observable, on your design system — takes most teams six months. NGAF gives the Angular surface that the rest of the stack assumes you've already built.

### Body — 10-row production-readiness checklist

Each row is one line:
`[check icon] [Production need (bold)] — [short description] — [NGAF primitive(s) in mono]`

| # | Production need | Description | NGAF primitive(s) |
|---|---|---|---|
| 1 | Durable threads | Persist across reloads, resume, branch, replay | `threadId` signal + durable transports |
| 2 | Resumable interrupts | Human-in-the-loop pause, resume token, retry, cancel | `interrupt()`, `resume()` |
| 3 | Tool calls as events | Stream progress, structured args, surfaced errors | tool events on `agent()` |
| 4 | Streaming state as signals | `messages()`, `status()`, `error()` — not promises | signal-native `agent()` |
| 5 | Generative UI on your design system | Vercel `json-render` + Google A2UI rendered into *your* Angular components | `@ngaf/render` |
| 6 | Recoverable errors | Retry, reload, error boundaries, fallback content | `error()`, `reload()` |
| 7 | Backend portability | LangGraph today; AG-UI / Mastra / CrewAI / your own tomorrow — same UI | runtime adapters behind one contract |
| 8 | Angular-native | DI, signals, RxJS interop — no React rewrite | built on Angular primitives, not ported |
| 9 | Observability hooks | Tracing seams; app telemetry off by default | event hooks, opt-in only |
| 10 | MIT + self-hosted | Own the primitives long-term, no vendor lock-in | MIT-licensed, no runtime SaaS dependency |

### Footer line (small, muted)
> Want help walking these on your codebase? → [Pilot to Prod](/pilot-to-prod)

(Tracked CTA: `home_why_pilot_to_prod`.)

## Visual treatment

- **Single column** of 10 rows; full Container width.
- Each row is a horizontal flex layout: `[check icon] [bold need] · [muted description, 1 line] · [mono NGAF primitive, right-aligned on viewport ≥ 640 px]`.
- Rows separated by hairlines (`tokens.surfaces.border`).
- On mobile (< 640): primitive drops below description; row stays one logical block.
- No card backgrounds — keep the section reading as a list, not a product grid.
- Check icon: inline SVG, accent color, ~16px, decorative (`aria-hidden`).

This is closer to the `/pilot-to-prod` Harden-phase checklist than to today's 4-card differentiator grid.

## Section ordering on the page

The section keeps its current position (after "Works with your agent stack"). No other landing-page section moves.

## File changes

- **Rewrite** `apps/website/src/components/landing/Differentiator.tsx`:
  - Replace the `CARDS` array with a `PRODUCTION_ROWS` array of the 10 entries above.
  - Replace the 4-card grid markup with the row layout described in *Visual treatment*.
  - Update the headline + subhead constants inline.
  - Add the footer "Pilot to Prod" link with `trackCtaClick` for `home_why_pilot_to_prod`.
- **No move/rename** of the component; the section name stays "Why this exists."
- **No changes** to `positioning.ts` — the section copy is local to the component since it is not reused elsewhere.

## Analytics

- New CTA event: `cta_id: 'home_why_pilot_to_prod'`, `surface: 'home'`, `cta_text: 'Pilot to Prod'`, `destination_url: '/pilot-to-prod'`.
- No impression event added; section is above the fold for most desktop sessions and existing scroll-depth events are sufficient.

## Out of scope

- Pricing copy, hero copy, nav, footer.
- The `Works with your agent stack` matrix above this section.
- The `/pilot-to-prod` page itself.
- Any change to the four NGAF concepts that were in the old 4-card grid; all four are absorbed into rows 1, 3, 5, and 7.

## Acceptance criteria

1. The section renders with the eyebrow, headline, subhead, 10 rows, and footer link exactly as specified above.
2. Each row shows a check icon, bold need, muted description, and mono primitive label.
3. On viewport widths below 640 px, the primitive label wraps below the description; on ≥ 640, the layout is two-column inside each row.
4. Clicking the footer link navigates to `/pilot-to-prod` and fires the `home_why_pilot_to_prod` CTA event.
5. The section retains its current vertical position and surrounding sections are unchanged.
6. Add `Differentiator.spec.tsx` (does not exist today) covering: the 10 rows render with their need + description + primitive, the footer link points to `/pilot-to-prod`, and clicking it fires the `home_why_pilot_to_prod` CTA event.
7. Lighthouse a11y score for `/` is not regressed; check icons have `aria-hidden`.

## Verification

- `npx nx serve website` and visually compare against the spec.
- `npx nx test website -- --testPathPattern Differentiator` if a spec file exists or is added.
- Page-load DOM should contain "Everything an Angular agent needs once the demo works." as the section h2.
