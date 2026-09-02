// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'pilot-journey';

/**
 * /pilot-to-prod marketing graphic: the three FeatureBlock phases of the
 * engagement (`id="discover"`, `id="build"`, `id="harden"` on the page) laid
 * out as a horizontal journey. Eyebrows and titles are lifted verbatim from
 * the page's own phase framing ("Week 1–2 · Discover", "Week 3–5 · Build",
 * "Week 6–7 · Harden"); each node's meta abbreviates that phase's actual
 * `rows` claims (stack audit + roadmap; real data + weekly demos;
 * observability + runbook) rather than inventing new copy.
 *
 * Gate pills mark ONLY the two transitions the page's copy actually names an
 * artifact for: Discover's own row api is literally "roadmap" (carried into
 * Build), and Build's headline is literally "Ship a working agent on your
 * real data" (the thing Harden then hardens). Both pills stay neutral so
 * they read as hand-offs, not payoffs. The Harden node carries the sole
 * accent: it is what the customer is left holding at the end of the
 * engagement (a production-ready, on-call-ready system), matching the
 * outcomes section below it on the page ("A working agent. A trained team.
 * A runbook.").
 *
 * Tiled at the kit-standard 640 viewWidth (16px outer margins) against
 * measured glyph widths (JetBrains Mono / Inter, actual `getBBox()` reads via
 * a live render of this exact composition — not a character-count estimate):
 *   node "Discover" meta "stack audit · roadmap"     text 107.1 → w=132 (slack 8.9)
 *   node "Build" meta "real data · weekly demos"     text 123.4 → w=146 (slack 6.6)
 *   node "Harden" meta "observability · runbook"     text 113.9 → w=136 (slack 6.1)
 *   pill "roadmap"                                   text 42.0 → w=52  (pad 5.0/side)
 *   pill "working agent"                             text 78.0 → w=94  (pad 8.0/side)
 * (meta is the widest line in every node; eyebrow and title both measure
 * narrower at 132/146/136.)
 * Inter-node rhythm mirrors RenderTransform: a 5px segment into each pill, a
 * 7px arrow-bearing segment out, a 2px arrowhead stop-short; the Build→Harden
 * gap (a real named artifact, "working agent") gets the same pill treatment
 * rather than a bare arrow, since the page names it too.
 */
export function PilotJourney() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={96}
      scale="marketing"
      label="The Pilot-to-Prod journey: Discover produces a roadmap, Build ships a working agent on your real data, and Harden turns it into the production-ready system you keep."
    >
      <DiagramNode
        x={16}
        y={16}
        w={132}
        h={64}
        eyebrow="Week 1–2"
        title="Discover"
        titleStyle="sans"
        meta="stack audit · roadmap"
        tone="dim"
      />
      <DiagramEdge d="M148 48 H153" slug={SLUG} />
      <DiagramPill cx={179} cy={48} w={52} label="roadmap" tone="neutral" />
      <DiagramEdge d="M205 48 H212" slug={SLUG} arrow />
      <DiagramNode
        x={214}
        y={16}
        w={146}
        h={64}
        eyebrow="Week 3–5"
        title="Build"
        titleStyle="sans"
        meta="real data · weekly demos"
      />
      <DiagramEdge d="M360 48 H365" slug={SLUG} />
      <DiagramPill cx={412} cy={48} w={94} label="working agent" tone="neutral" />
      <DiagramEdge d="M459 48 H466" slug={SLUG} arrow />
      <DiagramNode
        x={468}
        y={16}
        w={136}
        h={64}
        eyebrow="Week 6–7"
        title="Harden"
        titleStyle="sans"
        meta="observability · runbook"
        tone="accent"
      />
    </DiagramFrame>
  );
}
