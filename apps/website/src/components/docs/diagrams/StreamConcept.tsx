// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';

const SLUG = 'concept-stream';

/** Homepage concept card: tokens arrive as signals; the UI updates itself. */
export function StreamConcept() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={320}
      viewHeight={240}
      scale="compact"
      label="Streaming concept: a user message goes to injectAgent and the UI updates from its signals."
    >
      <DiagramNode x={16} y={57} w={124} h={44} title="User message" align="middle" titleStyle="sans" tone="dim" />
      <DiagramEdge d="M140 79 H154" slug={SLUG} arrow />
      <DiagramNode x={158} y={57} w={146} h={64} eyebrow="Signals" title="injectAgent()" meta="messages · status" />
      <DiagramEdge d="M231 121 V135" slug={SLUG} arrow />
      <DiagramNode x={70} y={139} w={180} h={44} title="UI updates itself" align="middle" titleStyle="sans" tone="accent" />
    </DiagramFrame>
  );
}
