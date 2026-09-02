// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';

const SLUG = 'render-vs-a2ui';

/**
 * The layering from the json-render-vs-A2UI concept page: `@threadplane/chat`
 * detects assistant content and streams it into whichever surface applies,
 * fanning out to a fixed json-render spec on one side and an A2UI surface on
 * the other.
 */
export function RenderVsA2ui() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={204}
      label="Chat detects assistant content and mounts either a json-render spec or an A2UI surface."
    >
      <DiagramNode
        x={190}
        y={16}
        w={260}
        h={64}
        eyebrow="Chat UI"
        title="@threadplane/chat"
        meta="detects content, streams, mounts surfaces"
        tone="neutral"
      />
      <DiagramEdge d="M320 80 V100 H180 V120" slug={SLUG} arrow />
      <DiagramEdge d="M320 80 V100 H460 V120" slug={SLUG} arrow />
      <DiagramNode
        x={60}
        y={124}
        w={240}
        h={64}
        eyebrow="json-render"
        title="@threadplane/render"
        meta="via registry, state store, functions"
        tone="accent"
      />
      <DiagramNode
        x={340}
        y={124}
        w={240}
        h={64}
        eyebrow="A2UI"
        title="@threadplane/a2ui"
        meta="A2UI v0.9 message and component types"
        tone="accent"
      />
    </DiagramFrame>
  );
}
