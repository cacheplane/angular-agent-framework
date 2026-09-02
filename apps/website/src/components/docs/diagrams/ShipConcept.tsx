// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'concept-ship';

/**
 * Homepage concept card: the thread survives everything between question and
 * answer — phrased against the `@threadplane/langgraph` persistence guide
 * ("keeps conversations alive across page refreshes, browser restarts, and
 * server deployments" / "users resume exactly where they left off"), not a
 * runtime-neutral claim (the design spec's CLAIMS table flags AG-UI history
 * as out of scope, so this card stays scoped to the LangGraph contract via
 * the reload/deploy pills rather than promising the same for every adapter).
 *
 * Geometry (viewHeight 240, centered): a single 52px-tall row — Thread
 * "Starts" (dim) breaks around the `reload` and `deploy` pills (12px
 * segments, 48px pills) into Thread "Resumes" (accent, the payoff). Content
 * height is just the 52px row; the remaining 188 splits into 94px top/bottom
 * margins. That is a wide empty band above and below a single row, but it is
 * accepted for grid uniformity with the other three cards (the dot grid
 * fills it) — a second row was considered (e.g. a "history intact" caption)
 * but dropped: the persistence guide's own "Adapter-defined behavior" callout
 * says thread-history restore is LangGraph-specific, and this card already
 * carries a LangGraph-scoped claim via reload/deploy, so adding another
 * unverifiable-across-runtimes line risked stacking the same overclaim twice
 * rather than earning its space.
 */
export function ShipConcept() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={320}
      viewHeight={240}
      scale="compact"
      label="Durability concept: a thread starts, survives a page reload and a deploy, and resumes."
    >
      <DiagramNode x={16} y={94} w={74} h={52} eyebrow="Thread" title="Starts" align="middle" titleStyle="sans" tone="dim" />
      <DiagramEdge d="M90 120 H102" slug={SLUG} />
      <DiagramPill cx={126} cy={120} w={48} label="reload" tone="neutral" />
      <DiagramEdge d="M150 120 H162" slug={SLUG} />
      <DiagramPill cx={186} cy={120} w={48} label="deploy" tone="neutral" />
      <DiagramEdge d="M210 120 H220" slug={SLUG} arrow />
      <DiagramNode x={224} y={94} w={80} h={52} eyebrow="Thread" title="Resumes" align="middle" titleStyle="sans" tone="accent" />
    </DiagramFrame>
  );
}
