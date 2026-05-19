# Hero collage simplification — drop the code window

**Status:** Design approved, ready for implementation plan.
**Owner:** apps/website
**Affects:** `apps/website/src/components/landing/Hero.tsx`

## Problem

The hero right column is a layered collage of two `BrowserFrame`s:

1. `demo.threadplane.ai` — the new generative-UI dashboard screenshot, rotated −3°, 92% width, positioned absolutely at top:0/left:0.
2. `agent.signal()` — a `<pre>` block containing a five-line `provideAgent` / `agent()` snippet, rotated +4°, 70% width, positioned absolutely at top:160/right:0.

The second frame is positioned over the lower-right quadrant of the dashboard. With the new screenshot in place, that quadrant contains the "Flights by Airline" bar chart and the "Recent Disruptions" table — i.e. the densest, most proof-heavy region of the image. The code window is fighting the hero's strongest visual proof.

## Decision

Drop the second `BrowserFrame` entirely. Keep one `BrowserFrame` rendering the dashboard at 100% column width, subtle −3° rotation, large elevation, unchanged URL label `demo.threadplane.ai`.

## Why this works

- The dashboard now occupies the right column unobstructed; KPI cards, charts, and the table all read clearly.
- We lose nothing semantic. `provideAgent({ apiUrl })` and `agent()` already appear:
  - In the hero's primary CTA ("Install @ngaf/chat") which copies the install command.
  - In the "Why this exists" section primitive labels (`signal-native agent()`, `interrupt(), resume()`, etc.).
  - In every install snippet across `/docs`.
- The code window was originally designed to add visual interest to an empty-looking chat demo screenshot. The new screenshot is dense; it doesn't need a counter-balance.
- Removes the absolute-positioning collage entirely, simplifying both layout and responsive behavior.

## Content changes

### Right column markup — before

```tsx
<div style={{ position: 'relative', minHeight: 420 }} aria-hidden="true">
  <BrowserFrame
    url="demo.threadplane.ai"
    rotate={-3}
    elevation="lg"
    style={{ position: 'absolute', top: 0, left: 0, width: '92%' }}
  >
    <img
      src="/screenshots/canonical-demo-generative-ui.webp"
      alt="Canonical demo — agent renders a live airline operations dashboard with KPI cards, charts, and a disruptions table"
      style={{ display: 'block', width: '100%', height: 'auto' }}
      loading="lazy"
      decoding="async"
    />
  </BrowserFrame>
  <BrowserFrame
    url="agent.signal()"
    rotate={4}
    elevation="md"
    style={{
      position: 'absolute',
      top: 160,
      right: 0,
      width: '70%',
      maxWidth: 320,
    }}
  >
    <pre
      style={{
        margin: 0,
        padding: '16px 18px',
        background: '#1a1b26',
        color: '#a9b1d6',
        fontFamily: tokens.typography.fontMono,
        fontSize: 12,
        lineHeight: 1.6,
        overflow: 'hidden',
      }}
    >
{`provideAgent({
  apiUrl: '/agent',
});

const a = agent();
a.messages();
a.status();`}
    </pre>
  </BrowserFrame>
</div>
```

### Right column markup — after

```tsx
<div aria-hidden="true">
  <BrowserFrame
    url="demo.threadplane.ai"
    rotate={-3}
    elevation="lg"
    style={{ width: '100%' }}
  >
    <img
      src="/screenshots/canonical-demo-generative-ui.webp"
      alt="Canonical demo — agent renders a live airline operations dashboard with KPI cards, charts, and a disruptions table"
      style={{ display: 'block', width: '100%', height: 'auto' }}
      loading="lazy"
      decoding="async"
    />
  </BrowserFrame>
</div>
```

## What stays exactly the same

- The hero grid (`gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 64`).
- The mobile collapse `@media (max-width: 900px)` rule.
- All left-column content (eyebrow, h1, `HERO_SUBHEAD`, install button, "Talk to our engineers" button, `POSITIONING_PROOF_POINTS` pill row, "Not another backend agent runtime…" line).
- The image asset path and alt text.
- The `aria-hidden="true"` on the right column.

## Out of scope

- The blink keyframe in the inline `<style>` block (`@keyframes blink { to { visibility: hidden; } }`) — currently unused but harmless; leave it alone, not part of this change.
- Hero left-column copy.
- Section ordering on the page.
- The `BrowserFrame` component itself.
- Pricing / nav / docs / footer.

## Acceptance criteria

1. Hero right column renders a single `BrowserFrame` with the dashboard screenshot at 100% column width.
2. No `<pre>` block, no second `BrowserFrame`, no `agent.signal()` URL label appears anywhere in `Hero.tsx`.
3. `position: absolute` and `position: relative` are removed from the right-column wrapper and its child.
4. `minHeight: 420` is removed from the right-column wrapper.
5. The dashboard image is fully visible on a desktop viewport (1280×820) — no other element overlaps any part of it.
6. On mobile (`< 900px`), the frame stacks below the copy and renders at full column width.
7. No other hero content is changed.

## Verification

- `npx vitest run` from `apps/website/` — same baseline as before this change (53 passing, 2 pre-existing failures unrelated to Hero).
- Visual check on the dev server at `http://localhost:3000/` at 1280×820: dashboard fills the right column unobstructed.
- Visual check at 375×812 (mobile preset): right-column frame appears below the copy.
