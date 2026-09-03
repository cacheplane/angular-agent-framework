import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'concept-approve';

/**
 * Homepage concept card: nothing irreversible without a human — the agent
 * proposes an action, an `interrupt` pauses for a human decision, and
 * `resume` sends the agent on with the decision (interrupts.mdx lifecycle:
 * Agent Plans → Interrupt Fires → UI Shows Dialog → User Decides → Agent
 * Resumes).
 *
 * Kept runtime-neutral per the design spec's CLAIMS table: both the LangGraph
 * and AG-UI interrupts guides use the same "agent pauses, hands control to a
 * human, resumes with the decision" language, so the card names neither
 * runtime and never claims durability (that's LangGraph-checkpoint-specific;
 * the AG-UI path differs).
 *
 * Geometry (viewHeight 240, centered): row 1 is a 52px-tall pair of nodes
 * broken by the `interrupt` pill (Agent → interrupt → Human, human accented
 * as the payoff — the buyer's control point). Human's right edge (x=214,
 * w=90 → 304) aligns with the outcome node's right edge (x=16, w=288 → 304).
 * A loop drops from the human node's bottom-mid (x=259), jogs 6px above the
 * `resume` pill's top face before dropping into it (avoids butting into the
 * pill along its border), and breaks around the pill into a 44px outcome
 * node. Content height 52 + 48 (12 segment + 24 pill + 8 segment + 4
 * arrow-fill) + 44 = 144; top/bottom margins split the remaining 96 evenly
 * (48 each), so the stack sits dead-center in the 240 frame.
 */
export function ApproveConcept() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={320}
      viewHeight={240}
      scale="compact"
      label="Approval concept: the agent plans an action, an interrupt pauses for a human decision, and the agent resumes with the decision."
    >
      <DiagramNode x={16} y={48} w={90} h={52} title="Agent" align="middle" titleStyle="sans" tone="dim" />
      <DiagramEdge d="M106 74 H118" slug={SLUG} />
      <DiagramPill cx={155} cy={74} w={74} label="interrupt" tone="neutral" />
      <DiagramEdge d="M192 74 H210" slug={SLUG} arrow />
      <DiagramNode x={214} y={48} w={90} h={52} title="Human" align="middle" titleStyle="sans" tone="accent" />

      <DiagramEdge d="M259 100 V106 H160 V112" slug={SLUG} />
      <DiagramPill cx={160} cy={124} w={56} label="resume" tone="neutral" />
      <DiagramEdge d="M160 136 V144" slug={SLUG} arrow />

      <DiagramNode
        x={16}
        y={148}
        w={288}
        h={44}
        title="Resumes with the decision"
        align="middle"
        titleStyle="sans"
      />
    </DiagramFrame>
  );
}
