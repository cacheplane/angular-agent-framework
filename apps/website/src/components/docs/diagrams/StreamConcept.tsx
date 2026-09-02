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
      viewHeight={160}
      scale="compact"
      label="Streaming concept: a user message goes to injectAgent, tokens come back as signals, and the UI updates itself."
    >
      <DiagramNode x={16} y={16} w={116} h={44} title="User message" align="middle" titleStyle="sans" tone="dim" />
      <DiagramEdge d="M132 38 H146" slug={SLUG} arrow />
      <DiagramNode x={150} y={16} w={154} h={64} eyebrow="Signals" title="injectAgent()" meta="messages · status" tone="accent" />
      <DiagramEdge d="M227 80 V96" slug={SLUG} arrow />
      <DiagramNode x={100} y={100} w={180} h={44} title="UI updates itself" align="middle" titleStyle="sans" />
    </DiagramFrame>
  );
}
