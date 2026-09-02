// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';

const SLUG = 'concept-render';

/**
 * Homepage concept card: a UI spec — abbreviated from the `@threadplane/render`
 * intro's own example (`type: 'Text'`, `props: { … }`) — resolves through
 * `defineAngularRegistry()` into your own Angular components.
 */
export function RenderConcept() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={320}
      viewHeight={240}
      scale="compact"
      label="Generative UI concept: a UI spec resolves through your Angular registry into your own components."
    >
      <DiagramNode
        x={16}
        y={16}
        w={288}
        h={64}
        eyebrow="Spec"
        title="type: 'Text'"
        meta="props: { … }"
        metaStyle="mono"
        tone="dim"
      />
      <DiagramEdge d="M160 80 V94" slug={SLUG} arrow />
      <DiagramNode
        x={16}
        y={98}
        w={288}
        h={64}
        eyebrow="Render"
        title="defineAngularRegistry()"
        meta="@threadplane/render"
      />
      <DiagramEdge d="M160 162 V176" slug={SLUG} arrow />
      <DiagramNode
        x={16}
        y={180}
        w={288}
        h={44}
        title="Your own Angular components"
        align="middle"
        titleStyle="sans"
        tone="accent"
      />
    </DiagramFrame>
  );
}
